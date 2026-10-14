import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { JoinRoomCard } from '../../features/rooms/JoinRoomCard.js';
import { PublicRoomList } from '../../features/rooms/PublicRoomList.js';
import { CreateRoomModal } from '../../features/rooms/CreateRoomModal.js';
import { PlusCircle } from 'lucide-react';

export const RoomsPage: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Multiplayer Game Rooms"
        subtitle="Discover open public rooms, enter private matches by code, or create your own custom lobby."
        badge={
          <Badge variant="brand" size="sm">
            Live Multiplayer
          </Badge>
        }
        actions={
          <Button
            size="sm"
            leftIcon={<PlusCircle className="w-4 h-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create New Room
          </Button>
        }
      />

      {/* Top Section: Join by Code */}
      <JoinRoomCard />

      {/* Main Section: Public Room Discovery Browser */}
      <PublicRoomList onOpenCreateModal={() => setIsCreateModalOpen(true)} />

      {/* Create Room Modal Dialog */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
};
