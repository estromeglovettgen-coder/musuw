<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { MessagePlugin } from 'tdesign-vue-next'
import { getCurrentUser, logout as logoutApi, userInfoFromApi } from '@/api/auth'
import { useI18n } from 'vue-i18n'
import CreateTenantDialog from '@/components/CreateTenantDialog.vue'
import {
  navigateAfterTenantSwitch,
  persistLastActiveTenantPreference,
  stashTenantSwitchToast,
} from '@/utils/tenantSwitch'
import type { TenantInfo } from '@/api/tenant'
import { useRoleLabel, useHomeTenant } from '@/composables/useRoleLabel'
import { getRootZoom, rectToCssPx, cssViewportSize } from '@/utils/zoom'
import { openNewUserGuide } from '@/config/contextualGuides'
import { SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE } from '@/config/settingsAccess'
import { handoffToExternalAuth } from '@/utils/nativeAuthHandoff'

const { t } = useI18n()
const router = useRouter()
const uiStore = useUIStore()
const authStore = useAuthStore()
const { formatRole, roleIcon } = useRoleLabel()
const { homeTenantId, isHomeTenant } = useHomeTenant()

const activeTenantName = computed(() => authStore.selectedTenantName || authStore.tenant?.name || '')
const currentRoleLabel = computed(() => formatRole(authStore.currentTenantRole))
const currentRoleIcon = computed(() => roleIcon(authStore.currentTenantRole))
const showTenantIdentityLine = computed(() => {
  if (authStore.isLiteMode) return false
  if (authStore.canAccessAllTenants) return true
  return (authStore.memberships ?? []).length > 1
})

const canManageMembers = computed(() =>
  authStore.canAccessAllTenants || authStore.hasRole(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE.members),
)
const canManageModels = computed(() =>
  authStore.canAccessAllTenants || authStore.isSystemAdmin ||
  authStore.hasRole(SETTINGS_MANAGEMENT_SHORTCUT_MIN_ROLE.models),
)

const menuRef = ref<HTMLElement>()
const tenantMenuItemRef = ref<HTMLElement>()
const menuVisible = ref(false)
const tenantSubmenuOpen = ref(false)
const tenantSubmenuStyle = ref<Record<string, string>>({})
let tenantSubmenuHideTimer: ReturnType<typeof setTimeout> | null = null

const userInfo = ref({
  username: t('common.defaultUser'),
  email: 'user@example.com',
  avatar: '',
})
const userName = computed(() => userInfo.value.username)
const userEmail = computed(() => userInfo.value.email)
const userAvatar = computed(() => userInfo.value.avatar)
const userInitial = computed(() => userName.value.charAt(0).toUpperCase())

const toggleMenu = () => { menuVisible.value = !menuVisible.value }
const handleQuickNav = (section: string) => {
  menuVisible.value = false
  uiStore.openSettings()
  router.push({ path: '/platform/settings', query: { section } })
}
const handleSettings = () => {
  menuVisible.value = false
  uiStore.openSettings()
  router.push('/platform/settings')
}
const handleSystemAdmin = () => {
  menuVisible.value = false
  uiStore.openSettings('system-global')
  router.push({ path: '/platform/settings', query: { section: 'system-global' } })
}
const closeAll = () => {
  tenantSubmenuOpen.value = false
  menuVisible.value = false
}

const createTenantDialogVisible = ref(false)
const openCreateTenantDialog = () => {
  closeAll()
  if (!authStore.canCreateTenant) {
    MessagePlugin.info(t('tenant.create.disabled'))
    return
  }
  createTenantDialogVisible.value = true
}
const onTenantCreated = async (newTenant: TenantInfo) => {
  await authStore.refreshFromAuthMe()
  authStore.setSelectedTenant(newTenant.id, newTenant.name)
  const persist = persistLastActiveTenantPreference(newTenant.id)
  Promise.race([persist, new Promise((r) => setTimeout(r, 300))])
    .finally(() => navigateAfterTenantSwitch())
}

type Membership = { tenant_id: number; tenant_name?: string; role: string }
const switchableMemberships = computed<Membership[]>(() => authStore.memberships ?? [])
const showTenantSwitcher = computed(() => switchableMemberships.value.length >= 1)
const isCurrentTenant = (id: number) => {
  const active = authStore.effectiveTenantId
  return active != null && Number(active) === Number(id)
}
const tenantDisplayName = (m: Membership) =>
  m.tenant_name && m.tenant_name.trim() !== '' ? m.tenant_name : `#${m.tenant_id}`
const tenantInitial = (m: Membership) => (tenantDisplayName(m).trim().charAt(0) || '?').toUpperCase()
const switchToTenant = (m: Membership) => {
  if (isCurrentTenant(m.tenant_id)) {
    closeAll()
    return
  }
  const home = homeTenantId.value
  const switchingToHome = home !== null && home === m.tenant_id
  authStore.setSelectedTenant(m.tenant_id, tenantDisplayName(m))
  closeAll()
  stashTenantSwitchToast({
    name: tenantDisplayName(m),
    role: formatRole(m.role) || undefined,
    roleEnum: m.role || undefined,
  })
  const persist = persistLastActiveTenantPreference(switchingToHome ? null : m.tenant_id)
  Promise.race([persist, new Promise((r) => setTimeout(r, 400))])
    .finally(() => navigateAfterTenantSwitch())
}

let lastTenantSubmenuMembershipRefresh = 0
const TENANT_SUBMENU_MEMBERSHIP_REFRESH_MS = 2000
const showTenantSubmenu = () => {
  if (tenantSubmenuHideTimer) {
    clearTimeout(tenantSubmenuHideTimer)
    tenantSubmenuHideTimer = null
  }
  positionTenantSubmenu()
  tenantSubmenuOpen.value = true
  clampFloatingToViewport('.visual-user-tenant-submenu', tenantSubmenuStyle)
  const now = Date.now()
  if (now - lastTenantSubmenuMembershipRefresh >= TENANT_SUBMENU_MEMBERSHIP_REFRESH_MS) {
    lastTenantSubmenuMembershipRefresh = now
    void authStore.refreshFromAuthMe()
  }
}
const scheduleHideTenantSubmenu = () => {
  if (tenantSubmenuHideTimer) clearTimeout(tenantSubmenuHideTimer)
  tenantSubmenuHideTimer = setTimeout(() => {
    tenantSubmenuOpen.value = false
    tenantSubmenuHideTimer = null
  }, 180)
}
const positionTenantSubmenu = () => {
  const el = tenantMenuItemRef.value
  if (!el) return
  const zoom = getRootZoom()
  const rect = rectToCssPx(el.getBoundingClientRect(), zoom)
  const { width: vw } = cssViewportSize(zoom)
  const PANEL_WIDTH = 264
  const GAP = 8
  const MARGIN = 8
  let left = rect.right + GAP
  if (left + PANEL_WIDTH + MARGIN > vw) left = Math.max(MARGIN, rect.left - PANEL_WIDTH - GAP)
  tenantSubmenuStyle.value = { left: `${left}px`, top: `${Math.max(MARGIN, rect.top)}px` }
}
const clampFloatingToViewport = (selector: string, target: { value: Record<string, string> }) => {
  requestAnimationFrame(() => {
    const panel = document.querySelector(selector) as HTMLElement | null
    if (!panel) return
    const MARGIN = 8
    const { height: vh } = cssViewportSize()
    const maxTop = vh - panel.offsetHeight - MARGIN
    const currentTop = parseFloat(target.value.top || '0') || 0
    if (currentTop > maxTop) target.value = { ...target.value, top: `${Math.max(MARGIN, maxTop)}px` }
  })
}

const reopenGuide = () => {
  menuVisible.value = false
  openNewUserGuide()
}
const openDocs = () => {
  menuVisible.value = false
  window.open('https://github.com/Tencent/WeKnora/tree/main/docs', '_blank')
}
const openGithub = () => {
  menuVisible.value = false
  window.open('https://github.com/Tencent/WeKnora', '_blank')
}

// Preserve Musuw's existing external-auth logout handoff while retaining the
// upstream menu capability set. This path existed in the first Musuw baseline.
const handleLogout = async () => {
  menuVisible.value = false
  try { await logoutApi() } catch (error) { console.error('Logout API failed:', error) }
  authStore.logout()
  MessagePlugin.success(t('auth.logout'))
  handoffToExternalAuth('logout')
}

const loadUserInfo = async () => {
  try {
    const response = await getCurrentUser()
    if (response.success && response.data?.user) {
      const user = response.data.user
      userInfo.value = {
        username: user.username || t('common.info'),
        email: user.email || 'user@example.com',
        avatar: user.avatar || '',
      }
      authStore.setUser(userInfoFromApi(user))
      if (response.data.tenant) {
        authStore.setTenant({
          id: String(response.data.tenant.id),
          name: response.data.tenant.name,
          owner_id: user.id,
          created_at: response.data.tenant.created_at,
          updated_at: response.data.tenant.updated_at,
        })
      } else {
        authStore.setTenant(null)
      }
      if (Array.isArray(response.data.memberships)) authStore.setMemberships(response.data.memberships)
      const canCreateTenant = response.data.capabilities?.can_create_tenant
      if (typeof canCreateTenant === 'boolean') authStore.setCanCreateTenant(canCreateTenant)
    }
  } catch (error) {
    console.error('Failed to load user info:', error)
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node
  if (menuRef.value?.contains(target)) return
  const tenantFloating = document.querySelector('.visual-user-tenant-submenu')
  if (tenantFloating?.contains(target)) return
  menuVisible.value = false
  tenantSubmenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  loadUserInfo()
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (tenantSubmenuHideTimer) clearTimeout(tenantSubmenuHideTimer)
})
</script>
