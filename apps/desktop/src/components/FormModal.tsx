import { useEffect, useState } from 'react';
import { Modal, ModalButton } from './Modal';
import { FieldGrid, missingRequired, type FieldDef, type FormValues } from './form';

/** Modal de cadastro/edição dirigido por FieldDefs. */
export function FormModal({
  open,
  title,
  subtitle,
  fields,
  initialValues,
  onSubmit,
  onClose,
  size = 'xl',
  extra,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  fields: FieldDef[];
  initialValues: FormValues;
  /** Retornar false mantém o modal aberto (validação reprovada). */
  onSubmit: (values: FormValues) => void | boolean | Promise<void | boolean>;
  onClose: () => void;
  size?: 'md' | 'lg' | 'xl';
  /** Conteúdo extra renderizado abaixo do grid (ex.: seleção de habilidades). */
  extra?: React.ReactNode;
}) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const missing = missingRequired(fields, values);

  async function handleSave() {
    if (missing.length > 0) return;
    setSaving(true);
    try {
      const result = await onSubmit(values);
      if (result !== false) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size={size}
      footer={
        <>
          {missing.length > 0 ? (
            <span className="mr-auto self-center text-xs text-ink-500">
              Preencha: {missing.join(', ')}
            </span>
          ) : null}
          <ModalButton variant="ghost" onClick={onClose}>
            Cancelar
          </ModalButton>
          <ModalButton onClick={handleSave} disabled={saving || missing.length > 0}>
            {saving ? 'Salvando...' : 'Salvar'}
          </ModalButton>
        </>
      }
    >
      <FieldGrid fields={fields} values={values} onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))} />
      {extra}
    </Modal>
  );
}
