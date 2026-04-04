import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader, Filter } from 'lucide-react';

interface Project {
  id: number;
  userId: number;
  type: string;
  height: number;
  width: number;
  estimatedPrice: number;
  status: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
}

interface Order {
  id: number;
  projectId: number;
  userId: number;
  wcOrderId: number;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  type: string;
  height: number;
  width: number;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
}

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'projects' | 'orders'>('projects');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.isAdmin) {
      setError('Acesso negado. Apenas administradores podem acessar esta página.');
      setLoading(false);
      return;
    }

    fetchData();
  }, [token, activeTab]);

  async function fetchData() {
    try {
      if (activeTab === 'projects') {
        const response = await fetch('http://localhost:5001/api/admin/projects', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Erro ao carregar projetos');
        const data = await response.json();
        setProjects(data);
      } else {
        const response = await fetch('http://localhost:5001/api/admin/orders', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Erro ao carregar pedidos');
        const data = await response.json();
        setOrders(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'straight': 'Reta',
      'landing': 'Patamar',
      'lshape': 'L',
      'spiral': 'Caracol',
    };
    return types[type] || type;
  };

  const filteredOrders = orders.filter(order => {
    if (paymentFilter === 'paid') return order.paymentStatus === 'paid';
    if (paymentFilter === 'unpaid') return order.paymentStatus === 'unpaid';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-4xl font-black text-slate-900 mb-8">Painel de Admin</h1>

      <div className="flex gap-4 mb-8 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-6 py-3 font-bold border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Projetos ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-6 py-3 font-bold border-b-2 transition-colors ${
            activeTab === 'orders'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Pedidos ({orders.length})
        </button>
      </div>

      {activeTab === 'projects' && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200">
                <th className="text-left py-3 px-4 font-bold text-slate-700">Cliente</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700">Email</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700">Tipo</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700">Dimensões</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700">Preço</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700">Status</th>
                <th className="text-left py-3 px-4 font-bold text-slate-700">Data</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">{project.firstName} {project.lastName}</td>
                  <td className="py-3 px-4 text-slate-600">{project.email}</td>
                  <td className="py-3 px-4">{getTypeLabel(project.type)}</td>
                  <td className="py-3 px-4">{project.height}mm × {project.width}mm</td>
                  <td className="py-3 px-4 font-bold text-green-600">R$ {(project.estimatedPrice / 100).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                      {project.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'orders' && (
        <>
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setPaymentFilter('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors ${
                paymentFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Filter className="w-4 h-4" />
              Todos ({orders.length})
            </button>
            <button
              onClick={() => setPaymentFilter('paid')}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                paymentFilter === 'paid'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Pagos ({orders.filter(o => o.paymentStatus === 'paid').length})
            </button>
            <button
              onClick={() => setPaymentFilter('unpaid')}
              className={`px-4 py-2 rounded-lg font-bold transition-colors ${
                paymentFilter === 'unpaid'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Não Pagos ({orders.filter(o => o.paymentStatus === 'unpaid').length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Pedido</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Cliente</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Escada</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Valor</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Pagamento</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-700">Data</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold">#{order.wcOrderId}</td>
                    <td className="py-3 px-4">{order.firstName} {order.lastName}</td>
                    <td className="py-3 px-4">{getTypeLabel(order.type)} ({order.height}mm)</td>
                    <td className="py-3 px-4 font-bold text-green-600">R$ {(order.totalPrice / 100).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        order.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
