import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Typography } from 'heroui-native';
import { CashRegisterStatus, type CashRegister } from '@beautypass/shared';
import { useFetch } from '../../lib/use-fetch';
import { formatMoney, formatDate } from '../../lib/format';
import { StatusChip } from '../../components/StatusChip';
import { LoadingState, EmptyState, ErrorState } from '../../components/ScreenStates';

interface Paginated<T> {
  data: T[];
  total: number;
}

const CASH_STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  closed: 'Fechado',
};

export default function CaixaScreen() {
  // GET /cash-registers/open returns the open register object or null/empty.
  const open = useFetch<CashRegister | null>('/cash-registers/open');
  const history = useFetch<Paginated<CashRegister>>('/cash-registers');

  const list = useMemo(() => history.data?.data ?? [], [history.data]);
  const openReg = open.data && open.data.id ? open.data : null;

  if (history.loading && !history.data) return <LoadingState />;
  if (history.error && !history.data) {
    return <ErrorState message={history.error} onRetry={history.refresh} />;
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 gap-4"
      refreshControl={
        <RefreshControl
          refreshing={history.refreshing}
          onRefresh={() => {
            open.refresh();
            history.refresh();
          }}
        />
      }
    >
      <Card>
        <Card.Body>
          <View className="flex-row items-center justify-between">
            <Typography type="h5" className="text-foreground">
              Caixa atual
            </Typography>
            <StatusChip
              status={openReg ? 'open' : 'closed'}
              label={openReg ? 'Aberto' : 'Fechado'}
            />
          </View>
          {openReg ? (
            <View className="mt-3 gap-1">
              <Typography color="muted" type="body-sm">
                Caixa #{openReg.number} · aberto em {formatDate(openReg.openedAt)}
              </Typography>
              <Typography type="h3" className="font-bold text-accent">
                {formatMoney(openReg.openingBalance)}
              </Typography>
              <Typography type="body-sm" color="muted">
                Saldo de abertura
              </Typography>
            </View>
          ) : (
            <View className="mt-3 flex-row items-center gap-2">
              <Ionicons name="lock-closed-outline" size={16} color="#6B6880" />
              <Typography color="muted">Nenhum caixa aberto no momento.</Typography>
            </View>
          )}
        </Card.Body>
      </Card>

      <View>
        <Typography type="h5" className="mb-2 text-foreground">
          Histórico
        </Typography>
        {list.length === 0 ? (
          <EmptyState
            icon="cash-outline"
            title="Sem movimentações"
            description="O histórico de caixas aparecerá aqui."
          />
        ) : (
          <View className="gap-3">
            {list.map((reg) => (
              <Card key={reg.id}>
                <Card.Body>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Typography className="font-semibold text-foreground">
                        Caixa #{reg.number}
                      </Typography>
                      <Typography type="body-sm" color="muted">
                        {formatDate(reg.openedAt)}
                        {reg.closedAt ? ` — ${formatDate(reg.closedAt)}` : ''}
                      </Typography>
                    </View>
                    <View className="items-end gap-1">
                      <Typography className="font-bold text-foreground">
                        {formatMoney(reg.countedBalance ?? reg.openingBalance)}
                      </Typography>
                      <StatusChip
                        status={reg.status}
                        label={
                          CASH_STATUS_LABELS[reg.status] ?? CashRegisterStatus.closed
                        }
                      />
                    </View>
                  </View>
                </Card.Body>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
