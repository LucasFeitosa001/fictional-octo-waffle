import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/Dashboard';
import { AgendaPage } from './pages/Agenda';
import { ClientesPage } from './pages/Clientes';
import { ProfissionaisPage } from './pages/Profissionais';
import { ServicosPage } from './pages/Servicos';
import { ProdutosPage } from './pages/Produtos';
import { FornecedoresPage } from './pages/Fornecedores';
import { GruposPage } from './pages/Grupos';
import { EstoquePage } from './pages/Estoque';
import { CaixaPage } from './pages/Caixa';
import { FinanceiroPage } from './pages/Financeiro';
import { RelatoriosPage } from './pages/Relatorios';
import { ConsultasPage } from './pages/Consultas';
import { ConfiguracoesPage } from './pages/Configuracoes';
import { SuportePage } from './pages/Suporte';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/profissionais" element={<ProfissionaisPage />} />
        <Route path="/servicos" element={<ServicosPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/grupos" element={<GruposPage />} />
        <Route path="/estoque" element={<EstoquePage />} />
        <Route path="/caixa" element={<CaixaPage />} />
        <Route path="/financeiro" element={<FinanceiroPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/consultas" element={<ConsultasPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/suporte" element={<SuportePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
