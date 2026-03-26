'use client';

import { Modal } from '@/components/ui/Modal';
import { useUIStore } from '@/stores/ui.store';
import { CreateGuildModal } from './CreateGuildModal';
import { CreateChannelModal } from './CreateChannelModal';
import { InviteModal } from './InviteModal';
import { JoinGuildModal } from './JoinGuildModal';

/**
 * Global modal mount point. Renders the correct modal based on ui.store.activeModal.
 */
export function ModalRoot() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);

  const isOpen = activeModal !== null;

  const renderContent = () => {
    switch (activeModal?.type) {
      case 'create-guild':
        return <CreateGuildModal />;
      case 'create-channel':
        return <CreateChannelModal />;
      case 'invite':
        return <InviteModal />;
      case 'join-guild':
        return <JoinGuildModal />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (activeModal?.type) {
      // CreateGuildModal provides its own title
      default:
        return undefined;
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={closeModal}
      title={getTitle()}
      showClose={activeModal?.type !== 'create-guild' && activeModal?.type !== 'join-guild' && activeModal?.type !== 'create-channel'}
      size={activeModal?.type === 'invite' ? 'md' : 'sm'}
    >
      {renderContent()}
    </Modal>
  );
}
