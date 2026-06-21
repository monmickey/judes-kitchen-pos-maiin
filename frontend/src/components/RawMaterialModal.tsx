import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCcw } from 'lucide-react';
import api from '../api/api';

interface RawMaterialModalProps {
  rawMaterial?: any | null;
  onClose: () => void;
  onSave: () => void;
}

const RawMaterialModal: React.FC<RawMaterialModalProps> = ({ rawMaterial, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    unit: 'kg',
    stockQuantity: 0,
    lowStockThreshold: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (rawMaterial) {
      setFormData({
        name: rawMaterial.name || '',
        unit: rawMaterial.unit || 'kg',
        stockQuantity: rawMaterial.stockQuantity || 0,
        lowStockThreshold: rawMaterial.lowStockThreshold || 0
      });
    } else {
      setFormData({
        name: '',
        unit: 'kg',
        stockQuantity: 0,
        lowStockThreshold: 0
      });
    }
  }, [rawMaterial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        name: formData.name,
        unit: formData.unit,
        stockQuantity: Number(formData.stockQuantity),
        lowStockThreshold: Number(formData.lowStockThreshold)
      };

      if (rawMaterial?.id) {
        await api.put(`/inventory/raw-materials/${rawMaterial.id}`, data);
      } else {
        await api.post('/inventory/raw-materials', data);
      }
      onSave();
    } catch (error: any) {
      console.error('Error saving raw material:', error);
      alert(error.response?.data?.error || 'Failed to save raw material');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            {rawMaterial ? 'Edit Raw Material' : 'Add Raw Material'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">
              Material Name *
            </label>
            <input
              required
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
              placeholder="e.g. Tomato, Cheese, Chicken"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">
                Standard Unit
              </label>
              <select
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none appearance-none cursor-pointer"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              >
                <option value="kg">kg (Kilograms)</option>
                <option value="g">gram (Grams)</option>
                <option value="ltr">ltr (Liters)</option>
                <option value="ml">ml (Milliliters)</option>
                <option value="pcs">pcs (Pieces)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">
                Low Stock Limit
              </label>
              <input
                required
                type="number"
                step="0.001"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
                value={formData.lowStockThreshold}
                onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {!rawMaterial && (
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-widest mb-1 font-mono">
                Opening Stock
              </label>
              <input
                type="number"
                step="0.001"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-brand-500 font-bold text-slate-800 outline-none"
                value={formData.stockQuantity}
                onChange={(e) => setFormData({ ...formData, stockQuantity: parseFloat(e.target.value) || 0 })}
              />
            </div>
          )}

          <div className="mt-8 flex gap-3 justify-end border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-brand-600 text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-brand-700 transition-all shadow-xl shadow-brand-500/20 disabled:opacity-50"
            >
              {saving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? 'Saving...' : 'Save Material'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RawMaterialModal;
