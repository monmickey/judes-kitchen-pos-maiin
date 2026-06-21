import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, Save, ArrowLeft, Calendar, User, 
  ChevronDown, Trash, Clock, Loader2, Sparkles, AlertCircle, CheckCircle2, Edit 
} from 'lucide-react';
import api from '../../api/api';
import { useNavigate } from 'react-router-dom';

// Reusable Input Component
const FormInput = ({ label, value, onChange, placeholder, type = "text", required = false }: any) => (
  <div className="relative group w-full">
    <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-brand-600 transition-colors">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      type={type} 
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full bg-white border-2 border-slate-100 focus:border-brand-600 focus:ring-0 rounded-xl p-3 text-slate-800 font-bold placeholder:text-slate-200 transition-all text-sm"
    />
  </div>
);

interface Vendor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface Product {
  id: string;
  productName: string;
  category?: string;
  unit?: string;
  defaultPrice?: number;
  stockQuantity?: number;
}

interface LineItem {
  productId: string;
  productName: string;
  category?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isFinishedProduct?: boolean;
}

const StockEntry = () => {
  const navigate = useNavigate();
  
  // Data lists
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productionProducts, setProductionProducts] = useState<any[]>([]);
  const [productionSearch, setProductionSearch] = useState('');
  const [productionCart, setProductionCart] = useState<any[]>([]);
  const [productionLoading, setProductionLoading] = useState(false);
  const [selectedRecipeProduct, setSelectedRecipeProduct] = useState<any | null>(null);
  const [recipeEditItems, setRecipeEditItems] = useState<any[]>([]);
  const [showRecipeEditModal, setShowRecipeEditModal] = useState(false);
  
  // Custom Production State
  const [showCustomProductionModal, setShowCustomProductionModal] = useState(false);
  const [allFinishedProducts, setAllFinishedProducts] = useState<any[]>([]);
  const [customProductionProduct, setCustomProductionProduct] = useState<string>('');
  const [customProductionQuantity, setCustomProductionQuantity] = useState<number>(1);
  const [customProductionIngredients, setCustomProductionIngredients] = useState<any[]>([
    { rawMaterialId: '', totalQuantity: 0 }
  ]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showNewFinishedProductModal, setShowNewFinishedProductModal] = useState(false);
  const [newFinishedProduct, setNewFinishedProduct] = useState({ name: '', categoryId: '', unit: 'pcs', sellingPrice: 0 });

  // Confirmation Modal State
  const [showProductionConfirmModal, setShowProductionConfirmModal] = useState(false);
  const [confirmModalDetails, setConfirmModalDetails] = useState<any>({
    items: [],
    ingredients: [],
    payload: null,
    isCustom: false
  });
  
  // Selections
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Search states
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Modals for adding new elements inline
  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', phone: '', email: '' });
  
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', category: '', unit: 'pcs' });
  
  // Procurement Table list (Cart)
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [associatedProducts, setAssociatedProducts] = useState<Product[]>([]);

  // Merge products with associated vendor product details (price and stock levels)
  const getEnrichedProducts = () => {
    const assocMap = new Map(associatedProducts.map(ap => [ap.id, ap]));
    return products.map(p => {
      const assoc = assocMap.get(p.id);
      if (assoc) {
        return {
          ...p,
          defaultPrice: assoc.defaultPrice,
          stockQuantity: assoc.stockQuantity ?? p.stockQuantity
        };
      }
      return p;
    });
  };
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch initial suppliers & products
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get('/procurements/workspace-data');
      const { vendors, rawMaterials, productionProducts, allFinishedProducts, categories } = res.data;
      setVendors(vendors);
      setProducts(rawMaterials);
      setProductionProducts(productionProducts);
      setAllFinishedProducts(allFinishedProducts);
      setCategories(categories);
    } catch (err: any) {
      console.error('Error fetching initial data:', err);
      setErrorMessage('Failed to load database lists. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  // Automatically fetch associated products when vendor is selected
  useEffect(() => {
    if (selectedVendor) {
      loadAssociatedProducts(selectedVendor.id);
    } else {
      setLineItems([]);
      setAssociatedProducts([]);
    }
  }, [selectedVendor]);

  const loadAssociatedProducts = async (vendorId: string) => {
    setActionLoading(true);
    try {
      const res = await api.get(`/procurements/vendors/${vendorId}/products`);
      setAssociatedProducts(res.data);
    } catch (err) {
      console.error('Error loading vendor products:', err);
      setAssociatedProducts([]);
    } finally {
      setActionLoading(false);
    }
  };

  // Production helper functions
  const addProductToProduction = (p: any) => {
    const exists = productionCart.find(item => item.productId === p.id);
    if (exists) {
      setProductionCart(prev => prev.map(item => 
        item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
      return;
    }
    setProductionCart(prev => [...prev, {
      productId: p.id,
      name: p.name,
      unit: p.unit || 'pcs',
      quantity: 1,
      recipe: p.recipe || [],
      currentStock: p.stockQuantity ?? 0
    }]);
  };

  const handleUpdateProductionItem = (productId: string, val: number) => {
    setProductionCart(prev => prev.map(item => 
      item.productId === productId ? { ...item, quantity: Math.max(1, val) } : item
    ));
  };

  const handleRemoveProductionItem = (productId: string) => {
    setProductionCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleProduceStock = () => {
    if (productionCart.length === 0) return;
    
    // Calculate accumulated ingredient requirements and verify local stock sufficiency
    const rawMap = new Map(products.map(p => [p.id, p]));
    const shortages: string[] = [];
    const rawNeeded: { [id: string]: number } = {};
    
    productionCart.forEach(item => {
      item.recipe.forEach((ing: any) => {
        const needed = ing.quantity * item.quantity;
        rawNeeded[ing.rawMaterialId] = (rawNeeded[ing.rawMaterialId] || 0) + needed;
      });
    });
    
    for (const [rawId, qtyNeeded] of Object.entries(rawNeeded)) {
      const raw = rawMap.get(rawId);
      const currentStock = raw ? (raw.stockQuantity ?? 0) : 0;
      if (currentStock < qtyNeeded) {
        const rawName = raw ? raw.productName : 'Unknown Ingredient';
        const rawUnit = raw ? (raw.unit || 'kg') : 'kg';
        shortages.push(`${rawName} (Shortage: ${(qtyNeeded - currentStock).toFixed(2)} ${rawUnit})`);
      }
    }
    
    if (shortages.length > 0) {
      alert(`Cannot produce. Insufficient raw material stocks:\n\n` + shortages.join('\n'));
      return;
    }
    
    setConfirmModalDetails({
      items: productionCart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit
      })),
      ingredients: Object.entries(rawNeeded).map(([rawId, qtyNeeded]) => {
        const raw = rawMap.get(rawId);
        return {
          name: raw ? raw.productName : 'Unknown Ingredient',
          quantity: qtyNeeded,
          unit: raw ? (raw.unit || 'units') : 'units'
        };
      }),
      payload: {
        items: productionCart.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      },
      isCustom: false
    });
    setShowProductionConfirmModal(true);
  };

  const executeProduction = async () => {
    if (!confirmModalDetails.payload) return;
    setProductionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await api.post('/production/produce', confirmModalDetails.payload);
      setSuccessMessage('Production completed successfully and stock levels updated!');
      setShowProductionConfirmModal(false);
      
      if (confirmModalDetails.isCustom) {
        setShowCustomProductionModal(false);
        setCustomProductionProduct('');
        setCustomProductionQuantity(1);
        setCustomProductionIngredients([{ rawMaterialId: '', totalQuantity: 0 }]);
      } else {
        setProductionCart([]);
      }
      
      await fetchInitialData(); // Reload all stock quantities
    } catch (err: any) {
      console.error('Error executing production:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to execute production. Server error.');
      alert('Production failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setProductionLoading(false);
    }
  };

  // Create new vendor inline
  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor.name.trim()) return;
    
    setActionLoading(true);
    try {
      const res = await api.post('/procurements/vendors', newVendor);
      const created: Vendor = res.data;
      setVendors(prev => [...prev, created]);
      setSelectedVendor(created);
      setVendorSearch(created.name);
      setShowNewVendorModal(false);
      setNewVendor({ name: '', phone: '', email: '' });
    } catch (err: any) {
      alert('Error creating vendor: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  // Create new product inline
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name.trim()) return;
    
    setActionLoading(true);
    try {
      const res = await api.post('/procurements/products', {
        productName: newProduct.name,
        category: newProduct.category,
        unit: newProduct.unit
      });
      const created: Product = res.data;
      
      // Add product to total list
      setProducts(prev => [...prev, created]);
      
      // Add product straight to procurement items list
      addProductToProcurement(created);
      
      setShowNewProductModal(false);
      setNewProduct({ name: '', category: '', unit: 'pcs' });
    } catch (err: any) {
      alert('Error creating product: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const addProductToProcurement = (p: Product) => {
    // Check if already exists in table
    const exists = lineItems.find(item => item.productId === p.id);
    if (exists) {
      // Highlight existing by increasing quantity
      handleUpdateItem(p.id, 'quantity', exists.quantity + 1);
      return;
    }

    const newItem: LineItem = {
      productId: p.id,
      productName: p.productName,
      category: p.category,
      unit: p.unit || 'pcs',
      quantity: 1,
      unitPrice: p.defaultPrice || 0,
      totalPrice: p.defaultPrice || 0
    };
    
    setLineItems(prev => [...prev, newItem]);
    setProductSearch('');
  };

  // Update item field (quantity or price)
  const handleUpdateItem = (productId: string, field: 'quantity' | 'unitPrice', val: number) => {
    setLineItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const quantity = field === 'quantity' ? Math.max(0, val) : item.quantity;
        const unitPrice = field === 'unitPrice' ? Math.max(0, val) : item.unitPrice;
        return {
          ...item,
          quantity,
          unitPrice,
          totalPrice: Number((quantity * unitPrice).toFixed(2))
        };
      }
      return item;
    }));
  };

  const handleRemoveItem = (productId: string) => {
    setLineItems(prev => prev.filter(item => item.productId !== productId));
  };

  // Totals calculations
  const subtotal = lineItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const grandTotal = subtotal; // Can add tax logic if needed

  // Save the entire procurement order to Supabase
  const handleSaveProcurement = async () => {
    if (!selectedVendor) {
      setErrorMessage('Please select a Vendor before saving.');
      return;
    }
    if (lineItems.length === 0) {
      setErrorMessage('Please add at least one product line item to the procurement.');
      return;
    }

    // Double check item values
    const hasZeroQty = lineItems.some(item => item.quantity <= 0);
    if (hasZeroQty) {
      setErrorMessage('All product items must have a quantity greater than zero.');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = {
        vendorId: selectedVendor.id,
        invoiceNumber: invoiceNumber || `PROC-${Date.now().toString().slice(-6)}`,
        totalAmount: grandTotal,
        items: lineItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          isFinishedProduct: item.isFinishedProduct || false
        }))
      };

      await api.post('/procurements', payload);
      setSuccessMessage('Procurement order saved successfully and product relations updated!');
      setLineItems([]);
      setSelectedVendor(null);
      setVendorSearch('');
      setInvoiceNumber('');
      
      // Navigate back to inventory list after a short success message delay
      setTimeout(() => {
        navigate('/inventory');
      }, 2000);
    } catch (err: any) {
      console.error('Error saving procurement:', err);
      setErrorMessage(err.response?.data?.error || 'Failed to save procurement. Server error.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-brand-600" size={40} />
          <p className="text-slate-500 font-black text-xs uppercase tracking-widest">Loading Procurement Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"><ArrowLeft size={22} /></button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">Stock Procurement</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Register supplier deliveries</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-brand-600" />
          <span className="text-xs font-black text-slate-600">{purchaseDate}</span>
        </div>
      </div>

      <div className="p-4 md:p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Configuration Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-brand-500" /> Sourcing Details
            </h2>

            {/* Vendor Selector Search Component */}
            <div className="relative group">
              <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-brand-600 transition-colors">Vendor Name *</label>
              <div className="w-full p-3 border-2 border-slate-100 focus-within:border-brand-600 focus-within:shadow-md rounded-xl flex items-center bg-white transition-all">
                <input 
                  type="text" 
                  placeholder="Select or search vendor..." 
                  value={vendorSearch} 
                  autoComplete="off"
                  onChange={(e) => { 
                    setVendorSearch(e.target.value); 
                    setShowVendorDropdown(true); 
                    if (selectedVendor && e.target.value !== selectedVendor.name) {
                      setSelectedVendor(null);
                    }
                  }}
                  onFocus={() => setShowVendorDropdown(true)}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-700 placeholder:text-slate-200 text-sm"
                />
                <ChevronDown size={16} className="text-slate-400 ml-2 cursor-pointer" onClick={() => setShowVendorDropdown(!showVendorDropdown)} />
              </div>
              
              {showVendorDropdown && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                  {vendors
                    .filter(v => v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                    .map((v, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => { 
                          setSelectedVendor(v); 
                          setVendorSearch(v.name); 
                          setShowVendorDropdown(false); 
                        }} 
                        className="w-full p-3 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-800 text-sm">{v.name}</div>
                          {v.phone && <div className="text-[10px] text-slate-400 font-bold uppercase">{v.phone}</div>}
                        </div>
                        <User size={14} className="text-slate-300" />
                      </button>
                    ))}
                  
                  {/* Add New Vendor Action */}
                  <button 
                    onClick={() => {
                      setShowVendorDropdown(false);
                      setShowNewVendorModal(true);
                    }}
                    className="w-full p-3 text-left bg-brand-50 hover:bg-brand-100 text-brand-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-t border-brand-100"
                  >
                    <Plus size={14} /> Add new vendor
                  </button>
                </div>
              )}
            </div>

            {/* Invoice Input */}
            <FormInput 
              label="Invoice Number / Ref" 
              value={invoiceNumber} 
              onChange={(e: any) => setInvoiceNumber(e.target.value)} 
              placeholder="e.g. INV-1092" 
            />

            {/* Error or Success notification inside panel */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-2.5 text-red-600 text-xs font-bold animate-shake">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            
            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-2.5 text-emerald-600 text-xs font-bold animate-fade-in">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}
          </div>
          
          {/* Quick Actions Panel */}
          {selectedVendor && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Vendor Meta Info</h3>
              <div className="text-xs font-bold text-slate-500 space-y-2">
                <div className="flex justify-between">
                  <span>Party:</span>
                  <span className="text-slate-800 font-black">{selectedVendor.name}</span>
                </div>
                {selectedVendor.phone && (
                  <div className="flex justify-between">
                    <span>Contact:</span>
                    <span className="text-slate-800 font-black">{selectedVendor.phone}</span>
                  </div>
                )}
                {selectedVendor.email && (
                  <div className="flex justify-between">
                    <span>Email:</span>
                    <span className="text-slate-800 font-black">{selectedVendor.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Product Lookup & Procurement Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 flex flex-col min-h-[500px]">
            
            {/* Searchable Product Lookup */}
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="relative group flex-1 w-full">
                <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-brand-600 transition-colors">Find / Add Product</label>
                <div className="w-full p-3 border-2 border-slate-100 focus-within:border-brand-600 focus-within:shadow-md rounded-xl flex items-center bg-white transition-all">
                  <Search size={16} className="text-slate-400 mr-2" />
                  <input 
                    type="text" 
                    placeholder="Search product from catalog..." 
                    value={productSearch} 
                    autoComplete="off"
                    onChange={(e) => { 
                      setProductSearch(e.target.value); 
                      setShowProductDropdown(true); 
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-700 placeholder:text-slate-200 text-sm"
                  />
                  {productSearch && (
                    <button onClick={() => setProductSearch('')} className="text-slate-300 hover:text-slate-500 font-black text-xs pr-2">Clear</button>
                  )}
                </div>
                
                {showProductDropdown && (
                  <div className="absolute z-40 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden max-h-52 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                    {(() => {
                      const enriched = getEnrichedProducts();
                      const assocIds = new Set(associatedProducts.map(ap => ap.id));
                      const filteredRaws = enriched.filter(p => p.productName.toLowerCase().includes(productSearch.toLowerCase()));

                      return (
                        <>
                          {/* Raw Materials */}
                          {filteredRaws.map((p, idx) => {
                            const isVendorProduct = assocIds.has(p.id);
                            return (
                              <button 
                                key={`raw-${idx}`} 
                                onClick={() => { 
                                  addProductToProcurement(p); 
                                  setShowProductDropdown(false); 
                                }} 
                                className="w-full p-3 text-left hover:bg-slate-50 flex items-center justify-between border-b border-slate-50 last:border-0 transition-colors"
                              >
                                <div>
                                  <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                    <span>{p.productName}</span>
                                    {isVendorProduct && (
                                      <span className="bg-emerald-100 text-emerald-700 text-[8px] px-1.5 py-0.5 rounded font-black uppercase">
                                        Sourced
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                    <span>Unit: {p.unit || 'pcs'}</span>
                                    <span>•</span>
                                    <span className="text-brand-600 font-extrabold">Stock: {p.stockQuantity ?? 0}</span>
                                    <span>•</span>
                                    <span>Price: ₹{p.defaultPrice || 0}</span>
                                  </div>
                                </div>
                                <Plus size={14} className="text-brand-500" />
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Inline Create Product Action */}
                    <button 
                      onClick={() => {
                        setShowProductDropdown(false);
                        setNewProduct(prev => ({ ...prev, name: productSearch }));
                        setShowNewProductModal(true);
                      }}
                      className="w-full p-3 text-left bg-brand-50 hover:bg-brand-100 text-brand-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 border-t border-brand-100"
                    >
                      <Plus size={14} /> Create product "{productSearch || 'New'}"
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Procurement Line Items Table */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider w-[40%]">Product Name</th>
                    <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-[15%]">Quantity</th>
                    <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right w-[20%]">Unit Price</th>
                    <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right w-[15%]">Total</th>
                    <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-[10%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <Clock size={32} className="text-slate-200 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No Products Drafted</p>
                        <p className="text-[10px] text-slate-300 mt-1">Select a vendor or search products to begin</p>
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 font-bold text-slate-800 text-sm">
                          <div>{item.productName}</div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.category || 'General'} ({item.unit})</span>
                        </td>
                        <td className="py-4 text-center">
                          <input 
                            type="number" 
                            min="1"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => handleUpdateItem(item.productId, 'quantity', Number(e.target.value))}
                            className="w-16 bg-slate-50 border-2 border-slate-100 rounded-lg p-1.5 font-bold text-slate-700 text-center text-xs focus:bg-white focus:border-brand-500 focus:ring-0 transition-all"
                          />
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[10px] text-slate-400 font-bold">₹</span>
                            <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              value={item.unitPrice === 0 ? '' : item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.productId, 'unitPrice', Number(e.target.value))}
                              className="w-20 bg-slate-50 border-2 border-slate-100 rounded-lg p-1.5 font-bold text-slate-700 text-right text-xs focus:bg-white focus:border-brand-500 focus:ring-0 transition-all"
                            />
                          </div>
                        </td>
                        <td className="py-4 text-right font-black text-slate-900 text-sm">
                          ₹{item.totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 text-center">
                          <button 
                            onClick={() => handleRemoveItem(item.productId)}
                            className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Subtotal & Calculations */}
            <div className="pt-6 border-t border-slate-100 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Subtotal ({lineItems.length} lines)</span>
                <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 font-black text-lg pt-2">
                <span>Total Procurement Value</span>
                <span className="text-2xl text-brand-600">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

          </div>

          {/* Vegetables & Raw Materials Catalog / Quick Add Grid */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-500" /> Vegetables & Raw Materials Catalog
                </h3>
                <p className="text-[9px] text-slate-300 font-bold uppercase mt-0.5">
                  {selectedVendor ? `Highlighting items supplied by ${selectedVendor.name}` : 'Click any item to stage in procurement'}
                </p>
              </div>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                {products.length} products available
              </span>
            </div>
            
            {products.length === 0 ? (
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider py-4 text-center">
                No vegetables or raw materials registered in catalog. Register new products using the button above.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(() => {
                  const enriched = getEnrichedProducts();
                  const assocIds = new Set(associatedProducts.map(ap => ap.id));
                  const orderedProducts = [
                    ...enriched.filter(p => assocIds.has(p.id)),
                    ...enriched.filter(p => !assocIds.has(p.id))
                  ];
                  
                  return orderedProducts.map((p) => {
                    const isAdded = lineItems.some(item => item.productId === p.id);
                    const isVendorProduct = assocIds.has(p.id);
                    
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProductToProcurement(p)}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-28 hover:scale-[1.02] active:scale-95 transition-all group relative overflow-hidden ${
                          isAdded 
                            ? 'bg-brand-50/50 border-brand-200 text-brand-700 font-black' 
                            : isVendorProduct
                            ? 'bg-emerald-50/20 border-emerald-100 text-slate-700 hover:border-brand-300'
                            : 'bg-slate-50/30 border-slate-100 text-slate-700 hover:border-brand-300'
                        }`}
                      >
                        {isVendorProduct && (
                          <span className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider">
                            Sourced
                          </span>
                        )}
                        
                        <div>
                          <p className="font-black text-xs line-clamp-2 leading-tight group-hover:text-brand-600 pr-8">
                            {p.productName}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {p.unit || 'pcs'} {p.category ? `• ${p.category}` : ''}
                          </p>
                          <p className="text-[9px] font-black text-brand-600 mt-0.5">
                            Stock: {p.stockQuantity ?? 0} {p.unit}
                          </p>
                        </div>
                        <div className="flex justify-between items-end mt-2">
                          <span className="text-[10px] font-extrabold text-slate-400 group-hover:text-brand-600">
                            ₹{p.defaultPrice || 0}
                          </span>
                          <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isAdded ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-brand-600 group-hover:text-white'
                          }`}>
                            {isAdded ? '✓' : '+'}
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Finished Products Production Catalog */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <span>🍽</span> Finished Products Production
                </h3>
                <p className="text-[9px] text-slate-300 font-bold uppercase mt-0.5">
                  Displaying finished products with mapped recipes. Click (+) to add to Production Cart.
                </p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowCustomProductionModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase px-3 py-2 rounded-xl flex items-center gap-1 transition-all border-b-2 border-blue-800"
                >
                  <Plus size={12} /> Custom Production
                </button>
                <div className="relative group w-full sm:max-w-[200px]">
                  <div className="w-full p-2 border-2 border-slate-100 focus-within:border-brand-600 focus-within:shadow-sm rounded-xl flex items-center bg-white transition-all">
                    <Search size={12} className="text-slate-400 mr-1.5" />
                    <input 
                      type="text" 
                      placeholder="Search recipes..." 
                      value={productionSearch} 
                      onChange={(e) => setProductionSearch(e.target.value)} 
                      className="w-full bg-transparent border-none focus:ring-0 p-0 font-bold text-slate-700 placeholder:text-slate-200 text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {productionProducts.length === 0 ? (
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider py-4 text-center">
                No finished products with recipes found in Recipe Matrix.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productionProducts
                  .filter(p => p.name.toLowerCase().includes(productionSearch.toLowerCase()))
                  .map((p) => {
                    const isAdded = productionCart.some(item => item.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProductToProduction(p)}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between min-h-[120px] hover:scale-[1.02] active:scale-95 transition-all group relative overflow-hidden ${
                          isAdded 
                            ? 'bg-blue-50/50 border-blue-200 text-blue-700 font-black' 
                            : 'bg-slate-50/30 border-slate-100 text-slate-700 hover:border-brand-300'
                        }`}
                      >
                        <button
                          type="button"
                          title="Edit Recipe"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecipeProduct(p);
                            setRecipeEditItems(p.recipe.map((r: any) => ({
                              rawMaterialId: r.rawMaterialId,
                              quantity: r.quantity
                            })));
                            setShowRecipeEditModal(true);
                          }}
                          className="absolute top-1.5 right-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full tracking-wider flex items-center gap-1 transition-all"
                        >
                          <span>Recipe Mapped</span>
                          <Edit size={8} />
                        </button>

                        <div>
                          <p className="font-black text-xs line-clamp-2 leading-tight group-hover:text-blue-600 pr-8">
                            {p.name}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            Stock: {p.stockQuantity ?? 0} {p.unit}
                          </p>
                          <div className="mt-1.5 space-y-0.5 max-h-[40px] overflow-y-auto pr-1">
                            <span className="text-[8px] font-black uppercase text-slate-400 block tracking-widest font-mono">Ingredients:</span>
                            <div className="text-[8px] text-slate-500 leading-tight font-medium">
                              {p.recipe.map((ing: any, i: number) => (
                                <div key={i} className="truncate">
                                  • {ing.name}: {ing.quantity} {ing.unit}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-end mt-2 pt-1 border-t border-slate-50/50 w-full">
                          <span className="text-[9px] font-extrabold text-blue-600">
                            {p.recipe.length} ingredients
                          </span>
                          <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isAdded ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-blue-600 group-hover:text-white'
                          }`}>
                            {isAdded ? '✓' : '+'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Production Cart */}
          {productionCart.length > 0 && (
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <span>🛒</span> Production Cart
                  </h3>
                  <p className="text-[9px] text-slate-300 font-bold uppercase mt-0.5">
                    Verify raw material requirements and estimated consumption before saving
                  </p>
                </div>
                <button 
                  onClick={() => setProductionCart([])}
                  className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 transition-colors"
                >
                  Clear Cart
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-left">
                      <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider w-[25%]">Product Name</th>
                      <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-[15%]">Qty to Produce</th>
                      <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider w-[30%]">Ingredients Required</th>
                      <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider w-[25%]">Estimated Consumption</th>
                      <th className="pb-3 text-[10px] font-black uppercase text-slate-400 tracking-wider text-center w-[5%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {productionCart.map((item, idx) => {
                      const rawMap = new Map(products.map(p => [p.id, p]));
                      
                      return (
                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 font-bold text-slate-800 text-xs">
                            <div>{item.name}</div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              Stock: {item.currentStock} {item.unit}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <input 
                              type="number" 
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateProductionItem(item.productId, Number(e.target.value))}
                              className="w-16 bg-slate-50 border-2 border-slate-100 rounded-lg p-1.5 font-bold text-slate-700 text-center text-xs focus:bg-white focus:border-brand-500 focus:ring-0 transition-all"
                            />
                          </td>
                          <td className="py-3 text-slate-500 text-[10px] leading-tight font-medium">
                            {item.recipe.map((ing: any, i: number) => (
                              <div key={i}>
                                • {ing.name}: {ing.quantity} {ing.unit}
                              </div>
                            ))}
                          </td>
                          <td className="py-3 text-[10px] leading-tight font-medium">
                            {item.recipe.map((ing: any, i: number) => {
                              const totalNeed = ing.quantity * item.quantity;
                              const raw = rawMap.get(ing.rawMaterialId);
                              const available = raw ? (raw.stockQuantity ?? 0) : 0;
                              const isShort = available < totalNeed;
                              
                              return (
                                <div 
                                  key={i} 
                                  className={isShort ? "text-red-600 font-extrabold flex items-center gap-1" : "text-slate-700"}
                                >
                                  • {ing.name}: {totalNeed.toFixed(2)} {ing.unit}
                                  {isShort && (
                                    <span className="bg-red-100 text-red-700 text-[7px] px-1 rounded font-black uppercase">
                                      Shortage (avail: {available})
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                          <td className="py-3 text-center">
                            <button 
                              onClick={() => handleRemoveProductionItem(item.productId)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={handleProduceStock}
                  disabled={productionLoading}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-8 py-3 rounded-xl active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 border-blue-800 shadow-xl shadow-blue-500/10"
                >
                  {productionLoading ? <Loader2 className="animate-spin" size={12} /> : 'Produce & Update Stock'}
                </button>
              </div>
            </div>
          )}


        </div>

      </div>

      {/* Floating Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 shadow-2xl z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="hidden md:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Procurement Summary</p>
            <p className="text-xs font-black text-slate-700">{lineItems.length} items staged / Total Value: ₹{grandTotal.toLocaleString('en-IN')}</p>
          </div>
          <button 
            onClick={handleSaveProcurement}
            disabled={actionLoading || lineItems.length === 0}
            className="w-full md:w-auto bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black px-8 py-3.5 rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 border-brand-800 shadow-xl shadow-brand-500/10"
          >
            {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            {actionLoading ? 'Saving procurement...' : 'Save Procurement'}
          </button>
        </div>
      </div>

      {/* Modal: New Vendor Inline Form */}
      {showNewVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <header className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base uppercase tracking-wider">Register Supplier</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Add a new vendor partner</p>
              </div>
              <button onClick={() => setShowNewVendorModal(false)} className="text-slate-400 hover:text-white font-black text-sm">✕</button>
            </header>
            <form onSubmit={handleCreateVendor} className="p-6 space-y-5">
              <FormInput 
                label="Vendor/Supplier Name" 
                value={newVendor.name} 
                onChange={(e: any) => setNewVendor({ ...newVendor, name: e.target.value })} 
                placeholder="e.g. Fresh Farm Suppliers" 
                required 
              />
              <FormInput 
                label="Contact Phone" 
                value={newVendor.phone} 
                onChange={(e: any) => setNewVendor({ ...newVendor, phone: e.target.value })} 
                placeholder="e.g. +91 9900223344" 
              />
              <FormInput 
                label="Email Address" 
                value={newVendor.email} 
                type="email"
                onChange={(e: any) => setNewVendor({ ...newVendor, email: e.target.value })} 
                placeholder="e.g. info@freshfarm.com" 
              />
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowNewVendorModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-3.5 rounded-xl transition-all text-xs"
                >Cancel</button>
                <button 
                  type="submit" 
                  disabled={actionLoading}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-black p-3.5 rounded-xl transition-all text-xs border-b-2 border-brand-800"
                >
                  {actionLoading ? 'Saving...' : 'Register Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Product Inline Form */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <header className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base uppercase tracking-wider">Catalog Add</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Create a new product record</p>
              </div>
              <button onClick={() => setShowNewProductModal(false)} className="text-slate-400 hover:text-white font-black text-sm">✕</button>
            </header>
            <form onSubmit={handleCreateProduct} className="p-6 space-y-5">
              <FormInput 
                label="Product Name" 
                value={newProduct.name} 
                onChange={(e: any) => setNewProduct({ ...newProduct, name: e.target.value })} 
                placeholder="e.g. Organic Tomatoes" 
                required 
              />
              <FormInput 
                label="Product Category" 
                value={newProduct.category} 
                onChange={(e: any) => setNewProduct({ ...newProduct, category: e.target.value })} 
                placeholder="e.g. Vegetables, Grocery" 
              />
              <div className="relative group w-full">
                <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">Unit of Measure</label>
                <div className="flex items-center gap-3 w-full p-2.5 border-2 border-slate-100 rounded-xl bg-white transition-all">
                  <select 
                    value={newProduct.unit} 
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                    className="w-full bg-transparent border-none focus:ring-0 text-slate-800 font-bold p-0 text-sm appearance-none cursor-pointer"
                  >
                    {['pcs', 'kg', 'ltr', 'box', 'pkt', 'gm', 'ml'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={14} className="text-slate-400 ml-auto pointer-events-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowNewProductModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-3.5 rounded-xl transition-all text-xs"
                >Cancel</button>
                <button 
                  type="submit" 
                  disabled={actionLoading}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-black p-3.5 rounded-xl transition-all text-xs border-b-2 border-brand-800"
                >
                  {actionLoading ? 'Saving...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Recipe Mapping */}
      {showRecipeEditModal && selectedRecipeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <header className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base uppercase tracking-wider">Configure Recipe</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{selectedRecipeProduct.name}</p>
              </div>
              <button 
                onClick={() => {
                  setShowRecipeEditModal(false);
                  setSelectedRecipeProduct(null);
                }} 
                className="text-slate-400 hover:text-white font-black text-sm"
              >
                ✕
              </button>
            </header>
            
            <div className="p-6 space-y-4">
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {recipeEditItems.length > 0 && (
                  <div className="flex gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 pb-1">
                    <span className="flex-1">Ingredient</span>
                    <span className="w-32 text-center">Qty / Unit</span>
                    <span className="w-10"></span>
                  </div>
                )}

                {recipeEditItems.map((item, idx) => {
                  const selectedMat = products.find(p => p.id === item.rawMaterialId);
                  const unitText = selectedMat ? selectedMat.unit : 'unit';

                  return (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        className="flex-1 p-2.5 bg-slate-50 border-none rounded-xl font-bold text-xs"
                        value={item.rawMaterialId}
                        onChange={e => {
                          const updated = [...recipeEditItems];
                          updated[idx].rawMaterialId = e.target.value;
                          setRecipeEditItems(updated);
                        }}
                      >
                        <option value="">-- Choose Ingredient --</option>
                        {products.map(r => (
                          <option key={r.id} value={r.id}>{r.productName}</option>
                        ))}
                      </select>
                      
                      <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 w-32 border-none">
                        <input 
                          type="number"
                          step="0.0001"
                          placeholder="Qty"
                          className="w-16 bg-transparent border-none focus:ring-0 p-2.5 font-bold text-xs text-center"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={e => {
                            const updated = [...recipeEditItems];
                            updated[idx].quantity = parseFloat(e.target.value) || 0;
                            setRecipeEditItems(updated);
                          }}
                        />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{unitText}</span>
                      </div>
                      
                      <button 
                        onClick={() => setRecipeEditItems(recipeEditItems.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
                
                <button 
                  onClick={() => setRecipeEditItems([...recipeEditItems, { rawMaterialId: '', quantity: 0 }])}
                  className="text-brand-600 font-black text-xs uppercase tracking-wider hover:underline py-1 block"
                >
                  + Add Ingredient Row
                </button>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowRecipeEditModal(false);
                    setSelectedRecipeProduct(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-3 rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={async () => {
                    const validRecipe = recipeEditItems.filter(i => i.rawMaterialId && i.quantity > 0);
                    try {
                      await api.patch(`/products/${selectedRecipeProduct.id}`, {
                        recipe: validRecipe
                      });
                      setShowRecipeEditModal(false);
                      setSelectedRecipeProduct(null);
                      alert('Recipe updated successfully!');
                      await fetchInitialData(); // Refresh list to get updated recipes
                    } catch (err: any) {
                      console.error('Failed to save recipe:', err);
                      alert(err.response?.data?.error || 'Failed to update recipe');
                    }
                  }}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-black p-3 rounded-xl transition-all text-xs border-b-2 border-brand-800"
                >
                  Save Recipe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Custom Finished Product Production */}
      {showCustomProductionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <header className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base uppercase tracking-wider">Custom Production</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Produce a finished product by choosing ingredients on-the-fly</p>
              </div>
              <button 
                onClick={() => {
                  setShowCustomProductionModal(false);
                  setCustomProductionProduct('');
                  setCustomProductionQuantity(1);
                  setCustomProductionIngredients([{ rawMaterialId: '', totalQuantity: 0 }]);
                }} 
                className="text-slate-400 hover:text-white font-black text-sm"
              >
                ✕
              </button>
            </header>
            
            <div className="p-6 space-y-4">
              {/* Product Selection */}
              <div className="relative group w-full">
                <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-brand-600 transition-colors">
                  Product to Produce *
                </label>
                <select
                  value={customProductionProduct}
                  onChange={e => {
                    const prodId = e.target.value;
                    if (prodId === 'NEW_FINISHED') {
                      setShowNewFinishedProductModal(true);
                      setCustomProductionProduct('');
                      return;
                    }
                    setCustomProductionProduct(prodId);
                    // If product has a recipe, pre-populate
                    const selected = allFinishedProducts.find(p => p.id === prodId);
                    if (selected) {
                      let recipeArray = selected.recipe;
                      if (typeof recipeArray === 'string') {
                        try {
                          recipeArray = JSON.parse(recipeArray);
                        } catch (err) {
                          recipeArray = [];
                        }
                      }
                      if (Array.isArray(recipeArray) && recipeArray.length > 0) {
                        setCustomProductionIngredients(recipeArray.map((ing: any) => ({
                          rawMaterialId: ing.rawMaterialId,
                          totalQuantity: Number(ing.quantity) * customProductionQuantity
                        })));
                      } else {
                        setCustomProductionIngredients([{ rawMaterialId: '', totalQuantity: 0 }]);
                      }
                    } else {
                      setCustomProductionIngredients([{ rawMaterialId: '', totalQuantity: 0 }]);
                    }
                  }}
                  className="w-full bg-white border-2 border-slate-100 focus-within:border-brand-600 rounded-xl p-3 text-slate-800 font-bold appearance-none cursor-pointer text-sm outline-none"
                >
                  <option value="">-- Select Product --</option>
                  {allFinishedProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stockQuantity} {p.unit})</option>
                  ))}
                  <option value="NEW_FINISHED" className="text-brand-600 font-bold">+ Register New Finished Product</option>
                </select>
              </div>

              {/* Quantity to Produce */}
              <div className="relative group w-full">
                <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-black text-slate-400 uppercase tracking-widest z-10 group-focus-within:text-brand-600 transition-colors">
                  Quantity to Produce *
                </label>
                <input
                  type="number"
                  min="1"
                  value={customProductionQuantity}
                  onChange={e => {
                    const newQty = Math.max(1, parseInt(e.target.value) || 1);
                    // Scale existing recipe ingredients if any
                    const selected = allFinishedProducts.find(p => p.id === customProductionProduct);
                    if (selected) {
                      let recipeArray = selected.recipe;
                      if (typeof recipeArray === 'string') {
                        try {
                          recipeArray = JSON.parse(recipeArray);
                        } catch (err) {
                          recipeArray = [];
                        }
                      }
                      if (Array.isArray(recipeArray) && recipeArray.length > 0) {
                        setCustomProductionIngredients(recipeArray.map((ing: any) => ({
                          rawMaterialId: ing.rawMaterialId,
                          totalQuantity: Number(ing.quantity) * newQty
                        })));
                      }
                    }
                    setCustomProductionQuantity(newQty);
                  }}
                  className="w-full bg-white border-2 border-slate-100 focus:border-brand-600 focus:ring-0 rounded-xl p-3 text-slate-800 font-bold placeholder:text-slate-200 transition-all text-sm"
                />
              </div>

              {/* Ingredients List */}
              <div className="space-y-3">
                <div className="flex gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  <span className="flex-1">Ingredient (Raw Material)</span>
                  <span className="w-32 text-center">Total Qty / Unit</span>
                  <span className="w-10"></span>
                </div>

                <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                  {customProductionIngredients.map((item, idx) => {
                    const selectedMat = products.find(p => p.id === item.rawMaterialId);
                    const unitText = selectedMat ? selectedMat.unit : 'unit';
                    const stockVal = selectedMat ? (selectedMat.stockQuantity ?? 0) : 0;
                    const isShort = selectedMat && stockVal < Number(item.totalQuantity);

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          <select
                            className="flex-1 p-2.5 bg-slate-50 border-none rounded-xl font-bold text-xs"
                            value={item.rawMaterialId}
                            onChange={e => {
                              const updated = [...customProductionIngredients];
                              updated[idx].rawMaterialId = e.target.value;
                              setCustomProductionIngredients(updated);
                            }}
                          >
                            <option value="">-- Choose Ingredient --</option>
                            {products.map(r => (
                              <option key={r.id} value={r.id}>{r.productName}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 w-32 border-none">
                            <input
                              type="number"
                              step="0.0001"
                              placeholder="Qty"
                              className="w-16 bg-transparent border-none focus:ring-0 p-2.5 font-bold text-xs text-center"
                              value={item.totalQuantity === 0 ? '' : item.totalQuantity}
                              onChange={e => {
                                const updated = [...customProductionIngredients];
                                updated[idx].totalQuantity = parseFloat(e.target.value) || 0;
                                setCustomProductionIngredients(updated);
                              }}
                            />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{unitText}</span>
                          </div>

                          <button
                            onClick={() => setCustomProductionIngredients(customProductionIngredients.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Stock feedback */}
                        {selectedMat && (
                          <div className="flex justify-between items-center px-2 text-[9px] font-bold">
                            <span className="text-slate-400 uppercase">Available Stock: {stockVal} {unitText}</span>
                            {isShort && (
                              <span className="text-red-600 font-extrabold uppercase bg-red-50 px-1.5 py-0.5 rounded">
                                Shortage of {(Number(item.totalQuantity) - stockVal).toFixed(2)} {unitText}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCustomProductionIngredients([...customProductionIngredients, { rawMaterialId: '', totalQuantity: 0 }])}
                  className="text-brand-600 font-black text-xs uppercase tracking-wider hover:underline py-1 block"
                >
                  + Add Ingredient Row
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomProductionModal(false);
                    setCustomProductionProduct('');
                    setCustomProductionQuantity(1);
                    setCustomProductionIngredients([{ rawMaterialId: '', totalQuantity: 0 }]);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-3 rounded-xl transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!customProductionProduct) {
                      alert('Please select a product to produce.');
                      return;
                    }
                    if (customProductionQuantity <= 0) {
                      alert('Please enter a quantity greater than zero.');
                      return;
                    }

                    const validIngredients = customProductionIngredients.filter(
                      i => i.rawMaterialId && i.totalQuantity > 0
                    );

                    if (validIngredients.length === 0) {
                      alert('Please add at least one ingredient with a quantity greater than zero.');
                      return;
                    }

                    // Client stock validation check
                    const shortages: string[] = [];
                    validIngredients.forEach(item => {
                      const raw = products.find(p => p.id === item.rawMaterialId);
                      const currentStock = raw ? (raw.stockQuantity ?? 0) : 0;
                      if (currentStock < item.totalQuantity) {
                        const rawName = raw ? raw.productName : 'Unknown Ingredient';
                        const rawUnit = raw ? (raw.unit || 'kg') : 'kg';
                        shortages.push(`${rawName} (Shortage: ${(item.totalQuantity - currentStock).toFixed(2)} ${rawUnit})`);
                      }
                    });

                    if (shortages.length > 0) {
                      alert(`Cannot produce. Insufficient raw material stocks:\n\n` + shortages.join('\n'));
                      return;
                    }

                    // Open confirmation modal
                    const selected = allFinishedProducts.find(p => p.id === customProductionProduct);
                    setConfirmModalDetails({
                      items: [{
                        name: selected ? selected.name : 'Custom Product',
                        quantity: customProductionQuantity,
                        unit: selected ? (selected.unit || 'pcs') : 'pcs'
                      }],
                      ingredients: validIngredients.map(item => {
                        const raw = products.find(p => p.id === item.rawMaterialId);
                        return {
                          name: raw ? raw.productName : 'Unknown Ingredient',
                          quantity: item.totalQuantity,
                          unit: raw ? (raw.unit || 'units') : 'units'
                        };
                      }),
                      payload: {
                        items: [{
                          productId: customProductionProduct,
                          quantity: customProductionQuantity,
                          customRecipe: validIngredients.map(ing => ({
                            rawMaterialId: ing.rawMaterialId,
                            quantity: Number(ing.totalQuantity) / Number(customProductionQuantity)
                          }))
                        }]
                      },
                      isCustom: true
                    });
                    setShowProductionConfirmModal(true);
                  }}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-black p-3 rounded-xl transition-all text-xs border-b-2 border-brand-800"
                >
                  Produce & Update Stock
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal: New Finished Product Inline Form */}
      {showNewFinishedProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <header className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base uppercase tracking-wider">Register Finished Product</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Create a selling item for production</p>
              </div>
              <button 
                onClick={() => {
                  setShowNewFinishedProductModal(false);
                  setNewFinishedProduct({ name: '', categoryId: '', unit: 'pcs', sellingPrice: 0 });
                }} 
                className="text-slate-400 hover:text-white font-black text-sm"
              >
                ✕
              </button>
            </header>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newFinishedProduct.name.trim()) return;
                
                setActionLoading(true);
                try {
                  const res = await api.post('/products', {
                    name: newFinishedProduct.name,
                    categoryId: newFinishedProduct.categoryId || null,
                    unit: newFinishedProduct.unit,
                    sellingPrice: Number(newFinishedProduct.sellingPrice),
                    purchasePrice: 0,
                    mrp: Number(newFinishedProduct.sellingPrice),
                    gstRate: 0,
                    stockQuantity: 0,
                    is_active: true
                  });
                  const created = res.data;
                  alert('Finished product registered successfully!');
                  setShowNewFinishedProductModal(false);
                  setNewFinishedProduct({ name: '', categoryId: '', unit: 'pcs', sellingPrice: 0 });
                  
                  await fetchInitialData();
                  setCustomProductionProduct(created.id);
                  setCustomProductionIngredients([{ rawMaterialId: '', totalQuantity: 0 }]);
                } catch (err: any) {
                  alert('Error creating finished product: ' + (err.response?.data?.error || err.message));
                } finally {
                  setActionLoading(false);
                }
              }} 
              className="p-6 space-y-5"
            >
              <FormInput 
                label="Product Name *" 
                value={newFinishedProduct.name} 
                onChange={(e: any) => setNewFinishedProduct({ ...newFinishedProduct, name: e.target.value })} 
                placeholder="e.g. Kappa Biriyani" 
                required 
              />
              
              <div className="relative group w-full">
                <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">Product Category</label>
                <div className="flex items-center gap-3 w-full p-2.5 border-2 border-slate-100 rounded-xl bg-white transition-all">
                  <select 
                    value={newFinishedProduct.categoryId} 
                    onChange={(e) => setNewFinishedProduct({ ...newFinishedProduct, categoryId: e.target.value })}
                    className="w-full bg-transparent border-none focus:ring-0 text-slate-800 font-bold p-0 text-sm appearance-none cursor-pointer"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="text-slate-400 ml-auto pointer-events-none" />
                </div>
              </div>

              <div className="relative group w-full">
                <label className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest z-10">Unit of Measure</label>
                <div className="flex items-center gap-3 w-full p-2.5 border-2 border-slate-100 rounded-xl bg-white transition-all">
                  <select 
                    value={newFinishedProduct.unit} 
                    onChange={(e) => setNewFinishedProduct({ ...newFinishedProduct, unit: e.target.value })}
                    className="w-full bg-transparent border-none focus:ring-0 text-slate-800 font-bold p-0 text-sm appearance-none cursor-pointer"
                  >
                    {['pcs', 'kg', 'ltr', 'box', 'pkt', 'gm', 'ml'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={14} className="text-slate-400 ml-auto pointer-events-none" />
                </div>
              </div>

              <FormInput 
                label="Selling Price (₹) *" 
                value={newFinishedProduct.sellingPrice || ''} 
                type="number"
                onChange={(e: any) => setNewFinishedProduct({ ...newFinishedProduct, sellingPrice: parseFloat(e.target.value) || 0 })} 
                placeholder="e.g. 130" 
                required 
              />
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowNewFinishedProductModal(false);
                    setNewFinishedProduct({ name: '', categoryId: '', unit: 'pcs', sellingPrice: 0 });
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-3.5 rounded-xl transition-all text-xs"
                >Cancel</button>
                <button 
                  type="submit" 
                  disabled={actionLoading}
                  className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-black p-3.5 rounded-xl transition-all text-xs border-b-2 border-brand-800"
                >
                  {actionLoading ? 'Saving...' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Production Confirmation */}
      {showProductionConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <header className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base uppercase tracking-wider">Confirm Production</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Verify kitchen production run</p>
              </div>
              <button 
                onClick={() => setShowProductionConfirmModal(false)} 
                className="text-slate-400 hover:text-white font-black text-sm"
              >
                ✕
              </button>
            </header>
            
            <div className="p-6 space-y-6">
              {/* Products to Produce */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block font-mono font-bold">Products to Produce:</span>
                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-2">
                  {confirmModalDetails.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center font-bold text-sm">
                      <span className="text-slate-800">{item.name}</span>
                      <span className="text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full text-xs font-black">
                        × {item.quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ingredients to Consume */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block font-mono font-bold">Ingredients Consumed:</span>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 max-h-[160px] overflow-y-auto space-y-1.5">
                  {confirmModalDetails.ingredients.map((ing: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-600">{ing.name}</span>
                      <span className="text-red-600 font-extrabold">
                        -{ing.quantity.toFixed(2)} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Result Summary */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block font-mono font-bold">Expected Result:</span>
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-xs font-bold text-emerald-800 space-y-1">
                  {confirmModalDetails.items.map((item: any, idx: number) => (
                    <div key={idx}>• Finished Product Stock +{item.quantity} {item.unit}</div>
                  ))}
                  <div>• Raw Material Stock Decreased automatically</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowProductionConfirmModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold p-3.5 rounded-xl transition-all text-xs uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={executeProduction}
                  disabled={productionLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black p-3.5 rounded-xl transition-all text-xs uppercase tracking-widest border-b-2 border-blue-800 shadow-lg shadow-blue-500/10 flex items-center justify-center gap-1.5"
                >
                  {productionLoading ? 'Updating...' : 'Produce & Update Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StockEntry;
