import { useState, useEffect, useRef, useCallback } from 'react';
import { searchProducts, getFrequentProducts } from '../api/products.api';

/**
 * Custom hook for product search with 150ms debounce.
 * Used by the ProductSearch component and can be used standalone.
 */
export function useProductSearch({ billType = 'retail', limit = 8 } = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [frequentProducts, setFrequentProducts] = useState([]);
  const timerRef = useRef(null);

  // Load frequent products on mount
  useEffect(() => {
    getFrequentProducts()
      .then(({ data }) => setFrequentProducts(Array.isArray(data?.data?.products) ? data.data.products : []))
      .catch(() => setFrequentProducts([]));
  }, []);

  // 150ms debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await searchProducts({ q: query.trim(), limit });
        const products = (Array.isArray(data?.data?.products) ? data.data.products : []).map((p) => ({
          ...p,
          stock_status: p.current_stock > 0 ? 'in_stock' : 'no_stock',
          display_price: billType === 'wholesale' ? p.wholesale_price : p.mrp,
        }));
        setResults(products);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, limit, billType]);

  // Barcode search — separate path, no debounce needed
  const searchByBarcode = useCallback(async (barcode) => {
    try {
      const { data } = await searchProducts({ barcode });
      const products = Array.isArray(data?.data?.products) ? data.data.products : [];
      return products.length > 0 ? products[0] : null;
    } catch {
      return null;
    }
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    frequentProducts,
    searchByBarcode,
  };
}

export default useProductSearch;
