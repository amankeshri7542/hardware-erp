import React, { useState, useRef, useEffect } from 'react';
import { Input, Spin, Tag, Empty } from 'antd';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { searchCustomers } from '../../api/customers.api';
import { formatINR } from '../../utils/formatCurrency';
import './CustomerSearch.css';

/**
 * Reusable CustomerSearch component with 200ms debounce.
 *
 * Props:
 *   onSelect(customer)  — called when user picks a customer
 *   autoFocus           — focus input on mount (default true)
 *   placeholder         — input placeholder text
 */
export default function CustomerSearch({
  onSelect,
  autoFocus = true,
  placeholder = 'Search customers by name, phone, or business...',
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // 200ms debounced search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query || query.trim().length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await searchCustomers({ search: query.trim(), limit: 10 });
        setResults(data.data?.customers || data.data || []);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  const handleSelect = (customer) => {
    onSelect(customer);
    setQuery(customer.name || '');
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && results[highlightIndex]) {
          handleSelect(results[highlightIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="customer-search-wrapper">
      <Input
        ref={inputRef}
        prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
        suffix={isLoading ? <Spin size="small" /> : null}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlightIndex(-1);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        size="large"
      />

      {isOpen && (
        <div className="customer-search-dropdown">
          {/* Loading */}
          {isLoading && (
            <div className="customer-search-loading">
              <Spin size="small" /> <span>Searching...</span>
            </div>
          )}

          {/* Results */}
          {!isLoading && results.length > 0 && (
            <ul className="customer-search-results">
              {results.map((cust, index) => (
                <li
                  key={cust.id}
                  className={`customer-search-item ${index === highlightIndex ? 'highlighted' : ''}`}
                  onMouseDown={() => handleSelect(cust)}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <div className="cust-item-main">
                    <span className="cust-item-name">{cust.name}</span>
                    {cust.business_name && (
                      <span className="cust-item-business">{cust.business_name}</span>
                    )}
                  </div>
                  <div className="cust-item-meta">
                    <div className="cust-item-right-top">
                      {cust.phone && <span className="cust-item-phone">{cust.phone}</span>}
                      <Tag color={cust.type === 'wholesale' ? 'blue' : 'green'} className="cust-type-tag">
                        {cust.type === 'wholesale' ? 'Wholesale' : 'Retail'}
                      </Tag>
                    </div>
                    {cust.outstanding_balance > 0 && (
                      <span className="cust-item-balance">
                        Due: {formatINR(cust.outstanding_balance)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Empty state */}
          {!isLoading && results.length === 0 && query.length >= 2 && (
            <div className="customer-search-empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No customers found"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
