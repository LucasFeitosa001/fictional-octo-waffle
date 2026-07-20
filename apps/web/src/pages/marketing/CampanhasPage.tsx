import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Button, Switch } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { Drawer } from '../../components/Drawer';

// ---------------------------------------------------------------------------
// Catálogo de campanhas automáticas do Belasis (rota /campaigns → aba Campanhas).
// Textos + ícones capturados 1:1 de belasis-reference/campaigns-marketing/desktop.html.
// Os ícones abaixo são os SVGs exatos do Belasis (Ant Design outline) inlinados
// para bater pixel a pixel. Sem data-wiring no componente anterior (era
// placeholder); os toggles usam estado local e "Personalizar" abre um drawer.
// TODO: ligar a hooks reais de campanhas/créditos quando a API estiver disponível.
// ---------------------------------------------------------------------------

type IconType = ComponentType<{ size?: number; className?: string }>;
type IconProps = { size?: number; className?: string };

function AntIcon({ size = 24, className, children, viewBox = '64 64 896 896' }: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

const AntGift: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M880 310H732.4c13.6-21.4 21.6-46.8 21.6-74 0-76.1-61.9-138-138-138-41.4 0-78.7 18.4-104 47.4-25.3-29-62.6-47.4-104-47.4-76.1 0-138 61.9-138 138 0 27.2 7.9 52.6 21.6 74H144c-17.7 0-32 14.3-32 32v200c0 4.4 3.6 8 8 8h40v344c0 17.7 14.3 32 32 32h640c17.7 0 32-14.3 32-32V550h40c4.4 0 8-3.6 8-8V342c0-17.7-14.3-32-32-32zm-334-74c0-38.6 31.4-70 70-70s70 31.4 70 70-31.4 70-70 70h-70v-70zm-138-70c38.6 0 70 31.4 70 70v70h-70c-38.6 0-70-31.4-70-70s31.4-70 70-70zM180 482V378h298v104H180zm48 68h250v308H228V550zm568 308H546V550h250v308zm48-376H546V378h298v104z" />
  </AntIcon>
);
const AntUsergroupAdd: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M892 772h-80v-80c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v80h-80c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h80v80c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-80h80c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zM373.5 498.4c-.9-8.7-1.4-17.5-1.4-26.4 0-15.9 1.5-31.4 4.3-46.5.7-3.6-1.2-7.3-4.5-8.8-13.6-6.1-26.1-14.5-36.9-25.1a127.54 127.54 0 01-38.7-95.4c.9-32.1 13.8-62.6 36.3-85.6 24.7-25.3 57.9-39.1 93.2-38.7 31.9.3 62.7 12.6 86 34.4 7.9 7.4 14.7 15.6 20.4 24.4 2 3.1 5.9 4.4 9.3 3.2 17.6-6.1 36.2-10.4 55.3-12.4 5.6-.6 8.8-6.6 6.3-11.6-32.5-64.3-98.9-108.7-175.7-109.9-110.8-1.7-203.2 89.2-203.2 200 0 62.8 28.9 118.8 74.2 155.5-31.8 14.7-61.1 35-86.5 60.4-54.8 54.7-85.8 126.9-87.8 204a8 8 0 008 8.2h56.1c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5 29.4-29.4 65.4-49.8 104.7-59.7 3.8-1.1 6.4-4.8 5.9-8.8zM824 472c0-109.4-87.9-198.3-196.9-200C516.3 270.3 424 361.2 424 472c0 62.8 29 118.8 74.2 155.5a300.95 300.95 0 00-86.4 60.4C357 742.6 326 814.8 324 891.8a8 8 0 008 8.2h56c4.3 0 7.9-3.4 8-7.7 1.9-58 25.4-112.3 66.7-153.5C505.8 695.7 563 672 624 672c110.4 0 200-89.5 200-200zm-109.5 90.5C690.3 586.7 658.2 600 624 600s-66.3-13.3-90.5-37.5a127.26 127.26 0 01-37.5-91.8c.3-32.8 13.4-64.5 36.3-88 24-24.6 56.1-38.3 90.4-38.7 33.9-.3 66.8 12.9 91 36.6 24.8 24.3 38.4 56.8 38.4 91.4-.1 34.2-13.4 66.3-37.6 90.5z" />
  </AntIcon>
);
const AntExclamation: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
    <path d="M464 688a48 48 0 1096 0 48 48 0 10-96 0zm24-112h48c4.4 0 8-3.6 8-8V296c0-4.4-3.6-8-8-8h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8z" />
  </AntIcon>
);
const AntHeart: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M923 283.6a260.04 260.04 0 00-56.9-82.8 264.4 264.4 0 00-84-55.5A265.34 265.34 0 00679.7 125c-49.3 0-97.4 13.5-139.2 39-10 6.1-19.5 12.8-28.5 20.1-9-7.3-18.5-14-28.5-20.1-41.8-25.5-89.9-39-139.2-39-35.5 0-69.9 6.8-102.4 20.3-31.4 13-59.7 31.7-84 55.5a258.44 258.44 0 00-56.9 82.8c-13.9 32.3-21 66.6-21 101.9 0 33.3 6.8 68 20.3 103.3 11.3 29.5 27.5 60.1 48.2 91 32.8 48.9 77.9 99.9 133.9 151.6 92.8 85.7 184.7 144.9 188.6 147.3l23.7 15.2c10.5 6.7 24 6.7 34.5 0l23.7-15.2c3.9-2.5 95.7-61.6 188.6-147.3 56-51.7 101.1-102.7 133.9-151.6 20.7-30.9 37-61.5 48.2-91 13.5-35.3 20.3-70 20.3-103.3.1-35.3-7-69.6-20.9-101.9zM512 814.8S156 586.7 156 385.5C156 283.6 240.3 201 344.3 201c73.1 0 136.5 40.8 167.7 100.4C543.2 241.8 606.6 201 679.7 201c104 0 188.3 82.6 188.3 184.5 0 201.2-356 429.3-356 429.3z" />
  </AntIcon>
);
const AntUndo: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M511.4 124C290.5 124.3 112 303 112 523.9c0 128 60.2 242 153.8 315.2l-37.5 48c-4.1 5.3-.3 13 6.3 12.9l167-.8c5.2 0 9-4.9 7.7-9.9L369.8 727a8 8 0 00-14.1-3L315 776.1c-10.2-8-20-16.7-29.3-26a318.64 318.64 0 01-68.6-101.7C200.4 609 192 567.1 192 523.9s8.4-85.1 25.1-124.5c16.1-38.1 39.2-72.3 68.6-101.7 29.4-29.4 63.6-52.5 101.7-68.6C426.9 212.4 468.8 204 512 204s85.1 8.4 124.5 25.1c38.1 16.1 72.3 39.2 101.7 68.6 29.4 29.4 52.5 63.6 68.6 101.7 16.7 39.4 25.1 81.3 25.1 124.5s-8.4 85.1-25.1 124.5a318.64 318.64 0 01-68.6 101.7c-7.5 7.5-15.3 14.5-23.4 21.2a7.93 7.93 0 00-1.2 11.1l39.4 50.5c2.8 3.5 7.9 4.1 11.4 1.3C854.5 760.8 912 649.1 912 523.9c0-221.1-179.4-400.2-400.6-399.9z" />
  </AntIcon>
);
const AntCalendar: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M880 184H712v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H384v-64c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v64H144c-17.7 0-32 14.3-32 32v664c0 17.7 14.3 32 32 32h736c17.7 0 32-14.3 32-32V216c0-17.7-14.3-32-32-32zm-40 656H184V460h656v380zM184 392V256h128v48c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8v-48h256v48c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8v-48h128v136H184z" />
  </AntIcon>
);
const AntLogin: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M521.7 82c-152.5-.4-286.7 78.5-363.4 197.7-3.4 5.3.4 12.3 6.7 12.3h70.3c4.8 0 9.3-2.1 12.3-5.8 7-8.5 14.5-16.7 22.4-24.5 32.6-32.5 70.5-58.1 112.7-75.9 43.6-18.4 90-27.8 137.9-27.8 47.9 0 94.3 9.3 137.9 27.8 42.2 17.8 80.1 43.4 112.7 75.9 32.6 32.5 58.1 70.4 76 112.5C865.7 417.8 875 464.1 875 512c0 47.9-9.4 94.2-27.8 137.8-17.8 42.1-43.4 80-76 112.5s-70.5 58.1-112.7 75.9A352.8 352.8 0 01520.6 866c-47.9 0-94.3-9.4-137.9-27.8A353.84 353.84 0 01270 762.3c-7.9-7.9-15.3-16.1-22.4-24.5-3-3.7-7.6-5.8-12.3-5.8H165c-6.3 0-10.2 7-6.7 12.3C234.9 863.2 368.5 942 520.6 942c236.2 0 428-190.1 430.4-425.6C953.4 277.1 761.3 82.6 521.7 82zM395.02 624v-76h-314c-4.4 0-8-3.6-8-8v-56c0-4.4 3.6-8 8-8h314v-76c0-6.7 7.8-10.5 13-6.3l141.9 112a8 8 0 010 12.6l-141.9 112c-5.2 4.1-13 .4-13-6.3z" />
  </AntIcon>
);
const AntMobile: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M744 62H280c-35.3 0-64 28.7-64 64v768c0 35.3 28.7 64 64 64h464c35.3 0 64-28.7 64-64V126c0-35.3-28.7-64-64-64zm-8 824H288V134h448v752zM472 784a40 40 0 1080 0 40 40 0 10-80 0z" />
  </AntIcon>
);
const AntAppstore: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M464 144H160c-8.8 0-16 7.2-16 16v304c0 8.8 7.2 16 16 16h304c8.8 0 16-7.2 16-16V160c0-8.8-7.2-16-16-16zm-52 268H212V212h200v200zm452-268H560c-8.8 0-16 7.2-16 16v304c0 8.8 7.2 16 16 16h304c8.8 0 16-7.2 16-16V160c0-8.8-7.2-16-16-16zm-52 268H612V212h200v200zM464 544H160c-8.8 0-16 7.2-16 16v304c0 8.8 7.2 16 16 16h304c8.8 0 16-7.2 16-16V560c0-8.8-7.2-16-16-16zm-52 268H212V612h200v200zm452-268H560c-8.8 0-16 7.2-16 16v304c0 8.8 7.2 16 16 16h304c8.8 0 16-7.2 16-16V560c0-8.8-7.2-16-16-16zm-52 268H612V612h200v200z" />
  </AntIcon>
);
const AntDollar: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372zm47.7-395.2l-25.4-5.9V348.6c38 5.2 61.5 29 65.5 58.2.5 4 3.9 6.9 7.9 6.9h44.9c4.7 0 8.4-4.1 8-8.8-6.1-62.3-57.4-102.3-125.9-109.2V263c0-4.4-3.6-8-8-8h-28.1c-4.4 0-8 3.6-8 8v33c-70.8 6.9-126.2 46-126.2 119 0 67.6 49.8 100.2 102.1 112.7l24.7 6.3v142.7c-44.2-5.9-69-29.5-74.1-61.3-.6-3.8-4-6.6-7.9-6.6H363c-4.7 0-8.4 4-8 8.7 4.5 55 46.2 105.6 135.2 112.1V761c0 4.4 3.6 8 8 8h28.4c4.4 0 8-3.6 8-8.1l-.2-31.7c78.3-6.9 134.3-48.8 134.3-124-.1-69.4-44.2-100.4-109-116.4zm-68.6-16.2c-5.6-1.6-10.3-3.1-15-5-33.8-12.2-49.5-31.9-49.5-57.3 0-36.3 27.5-57 64.5-61.7v124zM534.3 677V543.3c3.1.9 5.9 1.6 8.8 2.2 47.3 14.4 63.2 34.4 63.2 65.1 0 39.1-29.4 62.6-72 66.4z" />
  </AntIcon>
);
const AntWhatsApp: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M713.5 599.9c-10.9-5.6-65.2-32.2-75.3-35.8-10.1-3.8-17.5-5.6-24.8 5.6-7.4 11.1-28.4 35.8-35 43.3-6.4 7.4-12.9 8.3-23.8 2.8-64.8-32.4-107.3-57.8-150-131.1-11.3-19.5 11.3-18.1 32.4-60.2 3.6-7.4 1.8-13.7-1-19.3-2.8-5.6-24.8-59.8-34-81.9-8.9-21.5-18.1-18.5-24.8-18.9-6.4-.4-13.7-.4-21.1-.4-7.4 0-19.3 2.8-29.4 13.7-10.1 11.1-38.6 37.8-38.6 92s39.5 106.7 44.9 114.1c5.6 7.4 77.7 118.6 188.4 166.5 70 30.2 97.4 32.8 132.4 27.6 21.3-3.2 65.2-26.6 74.3-52.5 9.1-25.8 9.1-47.9 6.4-52.5-2.7-4.9-10.1-7.7-21-13z" />
    <path d="M925.2 338.4c-22.6-53.7-55-101.9-96.3-143.3a444.35 444.35 0 00-143.3-96.3C630.6 75.7 572.2 64 512 64h-2c-60.6.3-119.3 12.3-174.5 35.9a445.35 445.35 0 00-142 96.5c-40.9 41.3-73 89.3-95.2 142.8-23 55.4-34.6 114.3-34.3 174.9A449.4 449.4 0 00112 714v152a46 46 0 0046 46h152.1A449.4 449.4 0 00510 960h2.1c59.9 0 118-11.6 172.7-34.3a444.48 444.48 0 00142.8-95.2c41.3-40.9 73.8-88.7 96.5-142 23.6-55.2 35.6-113.9 35.9-174.5.3-60.9-11.5-120-34.8-175.6zm-151.1 438C704 845.8 611 884 512 884h-1.7c-60.3-.3-120.2-15.3-173.1-43.5l-8.4-4.5H188V695.2l-4.5-8.4C155.3 633.9 140.3 574 140 513.7c-.4-99.7 37.7-193.3 107.6-263.8 69.8-70.5 163.1-109.5 262.8-109.9h1.7c50 0 98.5 9.7 144.2 28.9 44.6 18.7 84.6 45.6 119 80 34.3 34.3 61.3 74.4 80 119 19.4 46.2 29.1 95.2 28.9 145.8-.6 99.6-39.7 192.9-110.1 262.7z" />
  </AntIcon>
);
const AntCashback: IconType = (p) => (
  <AntIcon {...p} viewBox="0 0 32 32">
    <path transform="translate(-204 -292)" d="M232.42 306.895c-.642 0-1.284.24-1.768.724l-2.933 2.936a2.485 2.485 0 00-1.455-1.08l-6.924-1.856a4.1 4.1 0 00-1.676-.092 4.096 4.096 0 00-1.572.584l-4.322 2.727-.35-.608a1.621 1.621 0 00-2.19-.585l-3.287 1.896a1.621 1.621 0 00-.586 2.19l4.899 8.482a1.62 1.62 0 002.187.588l3.287-1.899a1.622 1.622 0 00.588-2.19l-.064-.112 1.873-1.266 6.89 1.355c.945.186 1.789-.077 2.461-.765a531.235 531.235 0 016.706-6.764 1 1 0 00.006-.004 2.519 2.519 0 000-3.537 2.496 2.496 0 00-1.77-.725zm0 1.982a.5.5 0 01.353.156.48.48 0 010 .71 533.533 533.533 0 00-6.724 6.784c-.041.042-.588.21-.645.2l-7.299-1.434a1 1 0 00-.753.152l-2.1 1.42-2.48-4.295 4.386-2.765a2.1 2.1 0 011.664-.254l6.924 1.855a.48.48 0 01.354.614.48.48 0 01-.614.353l-4.345-1.164a1 1 0 00-1.225.707 1 1 0 00.707 1.225l4.346 1.164a2.52 2.52 0 002.592-.852 1 1 0 00.263-.176l4.242-4.244a.5.5 0 01.354-.156zm-22.533 2.697l.484.84a1 1 0 00.139.4 1 1 0 00.238.252l3.639 6.303-2.598 1.5-4.5-7.795zM224 301.014a1 1 0 00-1 1 1 1 0 001 1h2a1 1 0 001-1 1 1 0 00-1-1zM224 297.014a1 1 0 00-1 1 1 1 0 001 1h2a1 1 0 001-1 1 1 0 00-1-1z" />
    <path transform="translate(-204 -292)" d="M225 293.014c-3.854 0-7 3.146-7 7s3.146 7 7 7 7-3.146 7-7-3.146-7-7-7zm0 2c2.773 0 5 2.226 5 5 0 2.773-2.227 5-5 5s-5-2.227-5-5c0-2.774 2.227-5 5-5z" />
  </AntIcon>
);
const AntQuestion: IconType = (p) => (
  <AntIcon {...p}>
    <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
    <path d="M623.6 316.7C593.6 290.4 554 276 512 276s-81.6 14.5-111.6 40.7C369.2 344 352 380.7 352 420v7.6c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V420c0-44.1 43.1-80 96-80s96 35.9 96 80c0 31.1-22 59.6-56.1 72.7-21.2 8.1-39.2 22.3-52.1 40.9-13.1 19-19.9 41.8-19.9 64.9V620c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-22.7a48.3 48.3 0 0130.9-44.8c59-22.7 97.1-74.7 97.1-132.5.1-39.3-17.1-76-48.3-103.3zM472 732a40 40 0 1080 0 40 40 0 10-80 0z" />
  </AntIcon>
);

interface Campaign {
  id: string;
  icon: IconType;
  title: string;
  description: string;
  /** Mostra a linha "Envio automático" + switch. */
  hasAutoSwitch: boolean;
  /** Linha "Envio automático" apenas com ícone de ajuda (sem switch) — cards fixos. */
  autoInfoOnly?: boolean;
  /** Tooltip de ajuda ao lado da linha "Envio automático". */
  autoHint?: string;
  /** Mostra o botão/linha "Personalizar". */
  hasPersonalizar: boolean;
  /** "Personalizar" aparece desabilitado (não clicável). */
  personalizarDisabled?: boolean;
}

const CAMPAIGNS: Campaign[] = [
  {
    id: 'aniversario',
    icon: AntGift,
    title: 'Parabenize seus clientes',
    description:
      'Reforce os laços com seus clientes e mostre o quanto eles são especiais! Envie uma mensagem automática parabenizando os aniversariantes do dia. Isso fará com que esse dia se torne ainda mais especial e fortalecerá a relação entre vocês!',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'reconquista',
    icon: AntUsergroupAdd,
    title: 'Reconquiste clientes',
    description:
      'Já faz um tempo que o seu cliente não vem no seu estabelecimento? Recupere ele criando uma oferta super especial! Essa campanha enviará uma mensagem aos clientes que não retornaram após um período.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'lembretes',
    icon: AntExclamation,
    title: 'Evite esquecimentos',
    description:
      'Na correria do dia a dia o seu cliente pode esquecer do seu agendamento! Evite que isso aconteça e envie quantos lembretes forem necessários com tempos personalizados para que ele não esqueça do seu horário.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'cuidados',
    icon: AntHeart,
    title: 'Cuidados',
    description:
      'Fortaleça o relacionamento com seus clientes enviando mensagens automáticas de pré e pós-atendimento, personalizadas por serviço. Essas mensagens são enviadas apenas para agendamentos confirmados.',
    hasAutoSwitch: true,
    hasPersonalizar: false,
  },
  {
    id: 'retornos',
    icon: AntUndo,
    title: 'Garanta retornos',
    description:
      'Já passou um tempo e está na hora do seu cliente retornar para fazer novamente o serviço ou o produto dele está acabando? Lembre-o que está na hora dele retornar ao estabelecimento!',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'informados',
    icon: AntCalendar,
    title: 'Clientes bem informados',
    description:
      'Atualize o seu cliente sobre o andamento do seu agendamento! Envie mensagens avisando que o agendamento dele foi criado ou o seu status foi atualizado.',
    hasAutoSwitch: false,
    autoInfoOnly: true,
    autoHint:
      'Envie mensagens automáticas quando o agendamento for criado ou tiver o status atualizado.',
    hasPersonalizar: true,
    personalizarDisabled: true,
  },
  {
    id: 'boas-vindas',
    icon: AntLogin,
    title: 'Boas-vindas a novos clientes',
    description:
      'Que tal dar boas-vindas a um cliente e lhe ofertar um desconto? Esta campanha é enviada automaticamente aos clientes 1 dia após a sua primeira compra.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'convite-online',
    icon: AntMobile,
    title: 'Convide os clientes para agendar online',
    description:
      'Incentive os seus clientes a agendar online o seu próximo atendimento com uma oferta especial. Esta campanha é enviada aos clientes que nunca agendaram online.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'cashback',
    icon: AntCashback,
    title: 'Cashback',
    description: 'Envie ao seu cliente uma mensagem avisando sobre o seu saldo atual de cashback.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'pacote-expirando',
    icon: AntAppstore,
    title: 'Pacote expirando',
    description: 'Envie ao seu cliente uma mensagem avisando sobre o vencimento do pacote.',
    hasAutoSwitch: true,
    hasPersonalizar: true,
  },
  {
    id: 'cobrancas',
    icon: AntDollar,
    title: 'Realize cobranças',
    description:
      'Seu cliente deixou uma fatura em aberto e esqueceu de quitar no tempo combinado?! Lembre-o que há uma fatura em aberto no seu estabelecimento.',
    hasAutoSwitch: false,
    hasPersonalizar: true,
  },
  {
    id: 'pin-whatsapp',
    icon: AntWhatsApp,
    title: 'Enviar código PIN',
    description:
      'Envie o código PIN através do whatsapp, facilitando o acesso ao agendamento online',
    hasAutoSwitch: true,
    hasPersonalizar: false,
  },
];

// ------------------------------------------------------------------ card tile

function CampaignCard({
  campaign,
  active,
  onToggle,
  onPersonalizar,
}: {
  campaign: Campaign;
  active: boolean;
  onToggle: (v: boolean) => void;
  onPersonalizar: () => void;
}) {
  const Icon = campaign.icon;
  const hasAutoRow = campaign.hasAutoSwitch || campaign.autoInfoOnly;
  return (
    <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[0_0_10px_5px_color-mix(in_oklab,var(--sp-ink)_5%,transparent)]">
      {/* Conteúdo (wb__sc-u3tb4c-1) */}
      <div className="flex flex-1 flex-col items-center gap-3 p-4 text-center">
        <span className="mt-2 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon size={34} />
        </span>
        <span className="text-base font-semibold text-ink">{campaign.title}</span>
        <span className="text-sm leading-relaxed text-muted-ink">{campaign.description}</span>
      </div>

      {/* Envio automático (wb__sc-u3tb4c-3) */}
      {campaign.hasAutoSwitch ? (
        <div className="mt-auto flex items-center justify-center gap-2 border-t border-line px-4 py-3.5">
          <span className="text-sm text-muted-ink">Envio automático</span>
          <Switch isSelected={active} onChange={onToggle} aria-label={`Envio automático — ${campaign.title}`}>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
      ) : campaign.autoInfoOnly ? (
        <div className="mt-auto flex items-center justify-center gap-1.5 border-t border-line px-4 py-3.5">
          <span className="text-sm text-muted-ink">Envio automático</span>
          <span title={campaign.autoHint} className="inline-flex text-muted-ink">
            <AntQuestion size={15} />
          </span>
        </div>
      ) : null}

      {/* Personalizar (wb__sc-u3tb4c-2) */}
      {campaign.hasPersonalizar && (
        <div
          className={[
            'flex items-center justify-center border-t border-line px-4 py-3',
            hasAutoRow ? '' : 'mt-auto',
          ].join(' ')}
        >
          {campaign.personalizarDisabled ? (
            <span className="cursor-not-allowed text-sm font-medium text-muted-ink/60">
              Personalizar
            </span>
          ) : (
            <button
              type="button"
              onClick={onPersonalizar}
              className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              Personalizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------- créditos view

const RECARGA_COLUMNS = ['Data', 'Quantidade', 'Valor', 'Pagamento', 'Usuário', 'Status'];

function CreditosView() {
  const [autoRecarga, setAutoRecarga] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Card de saldo (roxo gradiente) */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--sp-primary)_78%,black)] p-6 text-primary-foreground shadow-[var(--shadow-card)]">
        <span className="text-sm opacity-90">Saldo de mensagens</span>
        <div className="mt-1 flex items-baseline gap-2">
          {/* TODO: saldo real de mensagens quando a API existir. */}
          <span className="text-4xl font-bold leading-none">200</span>
          <span className="text-lg opacity-90">mensagens</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <Button variant="outline" className="border-white/40 bg-white/10 text-primary-foreground hover:bg-white/20">
            Recarregar
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <span className="opacity-90">Recarga automática</span>
            <Switch isSelected={autoRecarga} onChange={setAutoRecarga} aria-label="Recarga automática">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </label>
        </div>
      </div>

      {/* Histórico de recargas */}
      <div className="overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold text-ink">Histórico de recargas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                {RECARGA_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-ink"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* TODO: linhas reais de recargas quando a API existir. */}
              <tr>
                <td colSpan={RECARGA_COLUMNS.length} className="px-4 py-10 text-center text-sm text-muted-ink">
                  Nenhuma recarga encontrada.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------- page

type View = 'campanhas' | 'creditos';

export function CampanhasPage() {
  const [view, setView] = useState<View>('campanhas');
  const [activeMap, setActiveMap] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [message, setMessage] = useState('');

  const editingActive = editing ? (activeMap[editing.id] ?? false) : false;

  const headerActions = useMemo(
    () => (
      <>
        <Button
          variant={view === 'campanhas' ? 'primary' : 'outline'}
          onClick={() => setView('campanhas')}
        >
          Campanhas
        </Button>
        <Button
          variant={view === 'creditos' ? 'primary' : 'outline'}
          onClick={() => setView('creditos')}
        >
          Créditos
        </Button>
      </>
    ),
    [view],
  );

  function openPersonalizar(campaign: Campaign) {
    setEditing(campaign);
    setMessage('');
  }

  return (
    <div>
      <PageHeader title="Campanhas" actions={headerActions} />

      {view === 'campanhas' ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {CAMPAIGNS.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              active={activeMap[campaign.id] ?? false}
              onToggle={(v) => setActiveMap((prev) => ({ ...prev, [campaign.id]: v }))}
              onPersonalizar={() => openPersonalizar(campaign)}
            />
          ))}
        </div>
      ) : (
        <CreditosView />
      )}

      {/* Drawer lateral de personalização (desliza da direita) */}
      <Drawer
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? editing.title : 'Personalizar campanha'}
        widthClass="sm:w-[520px]"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setEditing(null)}>
              Salvar
            </Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-muted-ink">{editing.description}</p>

            {editing.hasAutoSwitch && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card px-3 py-3">
                <span className="text-sm text-ink">Envio automático</span>
                <Switch
                  isSelected={editingActive}
                  onChange={(v: boolean) =>
                    setActiveMap((prev) => ({ ...prev, [editing.id]: v }))
                  }
                  aria-label="Envio automático"
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Mensagem</span>
              <span className="text-xs text-muted-ink">
                Use %NOME% para o nome do cliente e %ESTABELECIMENTO% para o nome do seu negócio.
              </span>
              <textarea
                value={message}
                rows={6}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite a mensagem que será enviada ao cliente…"
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
        )}
      </Drawer>
    </div>
  );
}
