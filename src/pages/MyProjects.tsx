import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trash2, Edit2, ShoppingCart, Loader, Plus } from 'lucide-react';

interface Project {
  id: number;
  type: string;
  height: number;
  width: number;
  length: number;
  stepHeight: number;
  stepDepth: number;
  steps: number;
  material: string;
  estimatedPrice: number;
  status: string;
  title?: string;
  createdAt: number;
}

interface MyProjectsProps {
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
}

export default function MyProjects({ onSelectProject, onNewProject }: MyProjectsProps) {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [token]);

  async function fetchProjects() {
    try {
      const response = await fetch('http://localhost:5001/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Erro ao carregar projetos');

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(id: number) {
    if (!confirm('Tem certeza que deseja deletar este projeto?')) return;

    try {
      const response = await fetch(`http://localhost:5001/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Erro ao deletar projeto');

      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar projeto');
    }
  }

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'straight': 'Escada Reta',
      'landing': 'Com Patamar',
      'lshape': 'Em L',
      'spiral': 'Caracol',
    };
    return types[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const statuses: Record<string, { label: string; color: string }> = {
      'draft': { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
      'saved': { label: 'Salvo', color: 'bg-blue-100 text-blue-700' },
      'checkout': { label: 'Em Checkout', color: 'bg-yellow-100 text-yellow-700' },
      'ordered': { label: 'Pedido', color: 'bg-green-100 text-green-700' },
    };
    return statuses[status] || { label: status, color: 'bg-slate-100 text-slate-700' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black text-slate-900">Meus Projetos</h1>
          <p className="text-slate-500 mt-2">Bem-vindo, {user?.firstName}!</p>
        </div>
        <button
          onClick={onNewProject}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Projeto
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum projeto ainda</h3>
          <p className="text-slate-500 mb-6">Crie seu primeiro projeto de escada agora!</p>
          <button
            onClick={onNewProject}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Criar Projeto
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => {
            const statusInfo = getStatusLabel(project.status);
            return (
              <div
                key={project.id}
                className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {project.title || getTypeLabel(project.type)}
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">
                      {project.height}mm × {project.width}mm | {project.steps} degraus
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6 py-4 border-y border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Tipo</p>
                    <p className="text-lg font-bold text-slate-900">{getTypeLabel(project.type)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Material</p>
                    <p className="text-lg font-bold text-slate-900">{project.material}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">Preço Estimado</p>
                    <p className="text-lg font-bold text-green-600">R$ {(project.estimatedPrice / 100).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => onSelectProject(project)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar
                  </button>
                  {project.status === 'saved' && (
                    <button
                      onClick={() => {/* TODO: Ir para checkout */}}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Checkout
                    </button>
                  )}
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
