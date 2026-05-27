'use client';
import { FC, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { UserSettings, Document, updateUserSettings } from '@/utils/userData';
import DocumentEditorPopup from '@/components/settings/DocumentEditorPopup';
import SubScreenShell from './_SubScreenShell';

interface Props {
  settings: UserSettings;
  onBack: () => void;
  onSave: (s: UserSettings) => void;
}

const DocumentsScreen: FC<Props> = ({ settings, onBack, onSave }) => {
  const t = useTranslations();
  const [documents, setDocuments] = useState<Document[]>(
    settings.documents ?? [],
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const handleAdd = () => {
    setIsCreating(true);
    setEditingIndex(null);
  };

  const handleEditorSave = (doc: Document) => {
    if (isCreating) {
      setDocuments([...documents, doc]);
    } else if (editingIndex !== null) {
      const next = [...documents];
      next[editingIndex] = doc;
      setDocuments(next);
    }
    setEditingIndex(null);
    setIsCreating(false);
  };

  const handleEditorCancel = () => {
    setEditingIndex(null);
    setIsCreating(false);
  };

  const handleRemove = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const updated: UserSettings = { ...settings, documents };
    const res = await updateUserSettings(updated);
    if (!res.error) onSave(updated);
  };

  return (
    <SubScreenShell
      title={t('settings.documents')}
      onBack={onBack}
      onSave={handleSave}
      saveLabel={t('common.save')}
    >
      <div className='flex flex-col gap-4 pt-2'>
        {documents.length === 0 ? (
          <p className='px-1 text-[15px] text-voice-text-tertiary'>
            {t('settings.noDocumentsAdded')}
          </p>
        ) : (
          <div className='bg-voice-elevated rounded-[14px] divide-y divide-voice-border overflow-hidden'>
            {documents.map((doc, index) => (
              <div
                key={index}
                className='flex items-center px-4 py-3'
              >
                <button
                  type='button'
                  onClick={() => {
                    setEditingIndex(index);
                    setIsCreating(false);
                  }}
                  className='flex-1 flex items-center justify-between text-left min-w-0'
                >
                  <span className='text-[17px] text-voice-text truncate pr-3'>
                    {doc.title || t('settings.untitledDocument')}
                  </span>
                  <ChevronRight
                    size={18}
                    className='shrink-0 text-voice-text-tertiary'
                  />
                </button>
                <button
                  type='button'
                  onClick={() => handleRemove(index)}
                  className='shrink-0 w-8 h-8 ml-1 flex items-center justify-center text-voice-text-tertiary'
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type='button'
          onClick={handleAdd}
          className='self-start px-1 text-[15px] text-voice-accent font-medium'
        >
          {t('settings.addDocument')}
        </button>
      </div>

      <DocumentEditorPopup
        isOpen={isCreating || editingIndex !== null}
        document={editingIndex !== null ? documents[editingIndex] : null}
        onSave={handleEditorSave}
        onCancel={handleEditorCancel}
      />
    </SubScreenShell>
  );
};

export default DocumentsScreen;
