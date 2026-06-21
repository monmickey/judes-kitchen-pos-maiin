import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Power } from 'lucide-react';
import api from '../../api/api';
import ProductModal from '../../components/ProductModal';
import RawMaterialModal from '../../components/RawMaterialModal';
import { Product } from '../../types';

const ProductManagement = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'raw_materials'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [isRawModalOpen, setIsRawModalOpen] = useState(false);
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<any | null>(null);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClosingShop, setIsClosingShop] = useState(false);

  const handleShopClose = async () => {
    if (window.confirm("Are you sure you want to close the shop? This will reset all active finished product stocks to 0. (Raw materials will not be affected.)")) {
      setIsClosingShop(true);
      try {
        const response = await api.post('/products/shop-close');
        alert(response.data.message || 'Shop closed successfully.');
        fetchProducts();
      } catch (error: any) {
        console.error('Error closing shop:', error);
        alert('Action Failed: ' + (error.response?.data?.error || error.message));
      } finally {
        setIsClosingShop(false);
      }
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRawMaterials = async () => {
    setLoading(true);
    try {
      const response = await api.get('/inventory/raw-materials');
      setRawMaterials(response.data);
    } catch (error) {
      console.error('Error fetching raw materials:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSearch(''); // clear search when switching tabs
    if (activeTab === 'products') {
      fetchProducts();
    } else {
      fetchRawMaterials();
    }
  }, [activeTab]);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleEditRawMaterial = (raw: any) => {
    setSelectedRawMaterial(raw);
    setIsRawModalOpen(true);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await api.patch(`/products/${id}`, { is_active: !currentStatus });
      fetchProducts();
    } catch (error) {
      console.error('Error toggling product status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await api.delete(`/products/${id}`);
        alert(response.data.message || 'Operation successful');
        fetchProducts();
      } catch (error: any) {
        console.error('Error deleting product:', error);
        alert('Action Failed: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const handleDeleteRawMaterial = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this raw material?')) {
      try {
        const response = await api.delete(`/inventory/raw-materials/${id}`);
        alert(response.data.message || 'Operation successful');
        fetchRawMaterials();
      } catch (error: any) {
        console.error('Error deleting raw material:', error);
        alert('Action Failed: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const filteredProducts = products.filter(p => 
    (p.is_active !== false) && 
    (p.name.toLowerCase().includes(search.toLowerCase()) || 
     p.barcode?.includes(search))
  );

  const filteredRawMaterials = rawMaterials.filter(rm => 
    (rm.is_active !== false) &&
    rm.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Inventory Matrix</h1>
          <p className="text-slate-500 font-medium text-xs md:text-base">Real-time stock management and valuation.</p>
        </div>
        <button 
          onClick={() => {
            if (activeTab === 'products') {
              setSelectedProduct(null);
              setIsModalOpen(true);
            } else {
              setSelectedRawMaterial(null);
              setIsRawModalOpen(true);
            }
          }}
          className="w-full md:w-auto bg-brand-primary hover:bg-brand-secondary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
        >
          <Plus size={20} />
          <span>{activeTab === 'products' ? 'ADD PRODUCT' : 'ADD RAW MATERIAL'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'products'
                  ? 'bg-white text-slate-800 shadow'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Finished Products
            </button>
            <button
              onClick={() => setActiveTab('raw_materials')}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'raw_materials'
                  ? 'bg-white text-slate-800 shadow'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Raw Materials
            </button>
          </div>
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={activeTab === 'products' ? "Search by name or code..." : "Search raw materials..."}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-brand-primary transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[900px] md:min-w-0">
            {activeTab === 'products' ? (
              <>
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Product Details</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Price</th>
                    <th className="px-6 py-4 font-semibold">Stock</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400 animate-pulse">Loading items...</td>
                    </tr>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0 overflow-hidden border border-slate-200">
                              {product.image ? (
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-black text-slate-300 text-xl uppercase">{product.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{product.name}</p>
                              <p className="text-xs text-slate-400 font-mono truncate">{product.barcode || 'NO BARCODE'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 truncate">{product.category?.name || 'General'}</td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800">₹{product.sellingPrice.toFixed(2)}</p>
                          <p className="text-[10px] text-emerald-600 font-bold">MRP: ₹{(product.mrp || product.sellingPrice).toFixed(2)}</p>
                          <p className="text-xs text-slate-400 font-medium">Cost: ₹{product.purchasePrice.toFixed(2)}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            product.stockQuantity < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                          }`}>
                            {product.stockQuantity} {product.unit}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleToggleActive(product.id, product.is_active ?? true)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors border ${
                              product.is_active !== false ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {product.is_active !== false ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleEdit(product)}
                              className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(product.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400">No products found</td>
                    </tr>
                  )}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Raw Material Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Price (Cost)</th>
                    <th className="px-6 py-4 font-semibold">Net Quantity</th>
                    <th className="px-6 py-4 font-semibold">Low Stock Threshold</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400 animate-pulse">Loading items...</td>
                    </tr>
                  ) : filteredRawMaterials.length > 0 ? (
                    filteredRawMaterials.map((raw) => {
                      const isLow = raw.stockQuantity <= raw.lowStockThreshold;
                      return (
                        <tr key={raw.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                                <Package size={20} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{raw.name}</p>
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-mono">{raw.unit}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 truncate">Raw Materials</td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            ₹{(raw.price || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              isLow ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                              {raw.stockQuantity.toFixed(3)} {raw.unit}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-bold">
                            {raw.lowStockThreshold} {raw.unit}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => handleEditRawMaterial(raw)}
                                className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-50 rounded-lg transition-colors"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDeleteRawMaterial(raw.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400">No raw materials found</td>
                    </tr>
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          disabled={isClosingShop}
          onClick={handleShopClose}
          className="w-full md:w-auto bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-red-600/25 transition-all active:scale-95"
        >
          <Power size={20} className={isClosingShop ? 'animate-spin' : ''} />
          <span>{isClosingShop ? 'CLOSING SHOP...' : 'SHOP CLOSE'}</span>
        </button>
      </div>

      {isModalOpen && (
        <ProductModal 
          product={selectedProduct}
          onClose={() => setIsModalOpen(false)}
          onSave={() => {
            setIsModalOpen(false);
            fetchProducts();
          }}
        />
      )}

      {isRawModalOpen && (
        <RawMaterialModal 
          rawMaterial={selectedRawMaterial}
          onClose={() => setIsRawModalOpen(false)}
          onSave={() => {
            setIsRawModalOpen(false);
            fetchRawMaterials();
          }}
        />
      )}
    </div>
  );
};

export default ProductManagement;
