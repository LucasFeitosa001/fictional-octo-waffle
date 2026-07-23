import { Button, Modal } from '@heroui/react';
import { IconLock, IconUsers } from './icons';

export function CrmLockedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>CRM</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col items-center py-3 text-center">
                <span className="relative grid h-16 w-16 place-items-center rounded-[14px] bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                  <IconUsers size={28} />
                  <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-lg border-2 border-card bg-card text-primary shadow-sm">
                    <IconLock size={14} />
                  </span>
                </span>
                <h2 className="mt-5 text-lg font-semibold text-ink">Módulo não adquirido</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-ink">
                  Sua empresa ainda não adquiriu o módulo de CRM.
                </p>
              </div>
            </Modal.Body>
            <Modal.Footer className="flex justify-end">
              <Button variant="primary" onPress={onClose}>
                Entendi
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
