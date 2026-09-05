import { kbFileTypeVerification } from '@/utils'
import { shouldRejectKnowledgeFileType } from '@/utils/fileTypeVerification'
import {
  DIRECT_VIDEO_EXTENSIONS,
  isDirectVideoUploadFile,
  MAX_VIDEO_UPLOAD_BYTES,
} from '@/utils/directVideoUpload'

export const UPLOAD_VIDEO_EXTENSIONS: string[] = [...DIRECT_VIDEO_EXTENSIONS]
export { MAX_VIDEO_UPLOAD_BYTES }

export function getUploadFileKey(file: File): string {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || ''
  return `${path || file.name}\0${file.size}`
}

export interface FilterUploadFilesOptions {
  supportedFileTypes?: Set<string> | string[]
  fromFolder?: boolean
  multiFile?: boolean
}

export interface FilterUploadFilesResult {
  validFiles: File[]
  skippedCount: number
  hiddenFileCount: number
}

export function partitionFilesForConsumerPlan(
  files: File[],
  options: { videoUpload: boolean },
): { allowedFiles: File[]; blockedVideoFiles: File[] } {
  if (options.videoUpload) {
    return { allowedFiles: [...files], blockedVideoFiles: [] }
  }

  const allowedFiles: File[] = []
  const blockedVideoFiles: File[] = []
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    if (UPLOAD_VIDEO_EXTENSIONS.includes(extension)) blockedVideoFiles.push(file)
    else allowedFiles.push(file)
  }
  return { allowedFiles, blockedVideoFiles }
}

export function filterUploadFiles(
  files: FileList | File[],
  options: FilterUploadFilesOptions = {},
): FilterUploadFilesResult {
  const list = Array.from(files)
  const dynamicTypesRaw = options.supportedFileTypes
    ? options.supportedFileTypes instanceof Set
      ? options.supportedFileTypes
      : new Set(options.supportedFileTypes)
    : undefined
  // An empty set means the parser-engine list hasn't loaded yet (race with the
  // async fetch on mount). Treat it as "unknown" and fall back to the default
  // whitelist instead of rejecting every file as unsupported.
  const dynamicTypes = dynamicTypesRaw && dynamicTypesRaw.size > 0 ? dynamicTypesRaw : undefined

  const validFiles: File[] = []
  let skippedCount = 0
  let hiddenFileCount = 0
  const multiFile = options.multiFile ?? list.length > 1
  const acceptedTypes = dynamicTypes
    ? new Set([...dynamicTypes, ...UPLOAD_VIDEO_EXTENSIONS])
    : undefined

  for (const file of list) {
    if (options.fromFolder) {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      if (relativePath.split('/').some(part => part.startsWith('.'))) {
        hiddenFileCount++
        continue
      }
    }

    // The shared verifier intentionally keeps ordinary documents at 50 MiB.
    // Supported videos use the exact byte ceiling here so a 300 MB browser
    // file can reach the direct R2 transport without changing the existing UI.
    const isVideo = isDirectVideoUploadFile(file)
    const rejectedType = shouldRejectKnowledgeFileType(file.name, acceptedTypes)
    const rejectedSize = isVideo
      ? file.size > MAX_VIDEO_UPLOAD_BYTES
      : kbFileTypeVerification(file, multiFile, acceptedTypes)
    if (rejectedType || rejectedSize) {
      skippedCount++
      continue
    }

    validFiles.push(file)
  }

  return { validFiles, skippedCount, hiddenFileCount }
}
