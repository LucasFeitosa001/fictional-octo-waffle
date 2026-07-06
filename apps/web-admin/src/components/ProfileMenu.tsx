'use client';

import { useRouter } from 'next/navigation';
import { Dropdown, Avatar, Label, Separator } from '@heroui/react';
import { IconUser, IconSettings, IconLogout, IconChevron } from './icons';
import { useSession, signOut } from '../lib/auth';
import { initials } from '../lib/format';

/**
 * Sidebar profile row → HeroUI v3 Dropdown. Replaces the previous dead
 * "Meu perfil" label with real actions: perfil, configurações, sair.
 */
export function ProfileMenu({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const name = session?.user?.name ?? 'Administrador';
  const email = session?.user?.email ?? '';

  function onAction(key: React.Key) {
    if (key === 'logout') {
      void signOut();
      return;
    }
    onNavigate?.();
    if (key === 'perfil') router.push('/configuracoes');
    if (key === 'config') router.push('/configuracoes');
  }

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <button
          type="button"
          className="mt-6 flex w-full items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.03]"
        >
          <Avatar size="sm">
            <Avatar.Fallback className="bg-white/[0.06] text-white/90">
              {initials(name)}
            </Avatar.Fallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-white">
              Olá, {name.split(' ')[0]}
            </div>
            <div className="text-[11px] text-white/45">Meu perfil</div>
          </div>
          <IconChevron size={14} className="rotate-180 text-white/35" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-[232px] border border-white/[0.1] bg-[#0c0c0d] shadow-2xl shadow-black/60">
        <div className="border-b border-white/[0.08] px-3 py-2.5">
          <div className="truncate text-[13px] font-semibold text-white">{name}</div>
          {email && <div className="truncate text-[11px] text-white/45">{email}</div>}
        </div>
        <Dropdown.Menu aria-label="Conta" onAction={onAction} className="p-1">
          <Dropdown.Item id="perfil" textValue="Meu perfil">
            <IconUser size={17} />
            <Label>Meu perfil</Label>
          </Dropdown.Item>
          <Dropdown.Item id="config" textValue="Configurações">
            <IconSettings size={17} />
            <Label>Configurações</Label>
          </Dropdown.Item>
          <Separator className="my-1 border-white/[0.08]" />
          <Dropdown.Item id="logout" textValue="Sair" variant="danger">
            <IconLogout size={17} />
            <Label>Sair</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
