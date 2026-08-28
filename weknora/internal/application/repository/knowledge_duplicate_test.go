package repository

import (
	"context"
	"testing"

	"github.com/Tencent/WeKnora/internal/types"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckKnowledgeExists_FileHashIsScopedByFileType(t *testing.T) {
	db := setupKnowledgeTestDB(t)
	repo := NewKnowledgeRepository(db)
	ctx := context.Background()
	tenantID := uint64(1)
	kbID := uuid.NewString()
	const fileHash = "same-content-hash"

	require.NoError(t, db.Exec(`
		INSERT INTO knowledges (id, tenant_id, knowledge_base_id, type, title, file_name, file_type, file_hash, parse_status)
		VALUES (?, ?, ?, 'file', 'document.md', 'document.md', 'md', ?, 'completed')
	`, uuid.NewString(), tenantID, kbID, fileHash).Error)

	t.Run("same content with another file type is allowed", func(t *testing.T) {
		exists, knowledge, err := repo.CheckKnowledgeExists(ctx, tenantID, kbID, &types.KnowledgeCheckParams{
			Type:     "file",
			FileHash: fileHash,
			FileType: "txt",
		})

		require.NoError(t, err)
		assert.False(t, exists)
		assert.Nil(t, knowledge)
	})

	t.Run("same content and file type remains a duplicate", func(t *testing.T) {
		exists, knowledge, err := repo.CheckKnowledgeExists(ctx, tenantID, kbID, &types.KnowledgeCheckParams{
			Type:     "file",
			FileHash: fileHash,
			FileType: "md",
		})

		require.NoError(t, err)
		assert.True(t, exists)
		require.NotNil(t, knowledge)
		assert.Equal(t, "md", knowledge.FileType)
	})

	t.Run("file type matching is case-insensitive", func(t *testing.T) {
		exists, knowledge, err := repo.CheckKnowledgeExists(ctx, tenantID, kbID, &types.KnowledgeCheckParams{
			Type:     "file",
			FileHash: fileHash,
			FileType: "MD",
		})

		require.NoError(t, err)
		assert.True(t, exists)
		require.NotNil(t, knowledge)
		assert.Equal(t, "md", knowledge.FileType)
	})
}

func TestAminusB_IgnoresFailedAndInFlightTargetRows(t *testing.T) {
	db := setupKnowledgeTestDB(t)
	repo := NewKnowledgeRepository(db)
	ctx := context.Background()
	const tenantID = uint64(1)
	sourceKB := uuid.NewString()
	targetKB := uuid.NewString()
	const fileHash = "retryable-source-hash"

	for _, row := range []struct {
		id     string
		kbID   string
		status string
	}{
		{id: uuid.NewString(), kbID: sourceKB, status: types.ParseStatusCompleted},
		{id: uuid.NewString(), kbID: targetKB, status: types.ParseStatusFailed},
		{id: uuid.NewString(), kbID: targetKB, status: types.ParseStatusProcessing},
	} {
		require.NoError(t, db.Exec(`
			INSERT INTO knowledges (id, tenant_id, knowledge_base_id, type, title, file_hash, parse_status)
			VALUES (?, ?, ?, 'file', 'retry-test', ?, ?)
		`, row.id, tenantID, row.kbID, fileHash, row.status).Error)
	}

	add, err := repo.AminusB(ctx, tenantID, sourceKB, tenantID, targetKB)
	require.NoError(t, err)
	if assert.Len(t, add, 1) {
		var sourceCount int64
		require.NoError(t, db.Model(&types.Knowledge{}).Where("id = ?", add[0]).Count(&sourceCount).Error)
		assert.Equal(t, int64(1), sourceCount)
	}

	del, err := repo.AminusB(ctx, tenantID, targetKB, tenantID, sourceKB)
	require.NoError(t, err)
	assert.Len(t, del, 2, "failed and processing target rows must both be removed on retry")
}
