'use client';

import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from './store';
import { cartAction } from './features/cart/cartSlice';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { productAction } from './features/products/productSlice';
import { v4 as uuidv4 } from 'uuid';

interface Product {
  _id: string;
  name: string;
  category: string;
  price: number;
  pic: string;
  uniqueId?: string;
}

interface ErrorState {
  product: string;
  cart: string;
}

interface PageState {
  [key: string]: number;
}

interface EndState {
  [key: string]: boolean;
}

export default function Store() {
  const accessToken = useSelector((state: RootState) => state.auth.auth);
  const cachedProducts = useSelector((state: RootState) => state.product.products);
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [products, setProducts] = useState<Product[]>(cachedProducts);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<PageState>({});
  const [atEnd, setAtEnd] = useState<EndState>({});
  const [error, setError] = useState<ErrorState>({ product: '', cart: '' });
  const hasFetchedProducts = useRef(false);
  const fetchedProductIds = useRef(new Set<string>());

  const getAllProducts = async (start: number, end: number) => {
    try {
      const response = await axios.post('/api/productAPI/all', { start, end }, { headers: { Authorization: `Bearer ${accessToken}` } });
      const fetchedProducts: Product[] = response.data.data.data;

      if (fetchedProducts.length !== 0) {
        const productsWithUniqueIds = fetchedProducts
          .filter(product => !fetchedProductIds.current.has(product._id))
          .map(product => {
            fetchedProductIds.current.add(product._id);
            return { ...product, uniqueId: `${product._id}-${uuidv4()}` };
          });

        setProducts(prev => {
          const newProducts = [...prev, ...productsWithUniqueIds];
          dispatch(productAction({ products: newProducts, currentNumber: end }));
          return newProducts;
        });

        setCategories(prevCategories => {
          const uniqueCategories = productsWithUniqueIds.reduce<string[]>((acc: string[], item: Product) => {
            if (!acc.includes(item.category)) {
              setAtEnd(prev => ({ ...prev, [item.category]: false }));
              acc.push(item.category);
            }
            return acc;
          }, prevCategories);
          return uniqueCategories;
        });

        setCurrentPage(prevPages => {
          const pages = { ...prevPages };
          productsWithUniqueIds.forEach(product => {
            if (!pages[product.category]) {
              pages[product.category] = Math.max(1, pages[product.category] || 1);
            }
          });
          return pages;
        });
      }

    } catch (err) {
      setError(prev => ({ ...prev, product: "I'm sorry we're running into some problems" }));
    }
  };

  useEffect(() => {
    if (!accessToken) {
      router.push('/authentication');
    } else {
      if (!hasFetchedProducts.current) {
        hasFetchedProducts.current = true;
        if (cachedProducts.length === 0) {
          getAllProducts(0, 3);
        } else {
          setProducts(cachedProducts);
          const uniqueCategories = cachedProducts.reduce((acc: string[], item: Product) => {
            if (!acc.includes(item.category)) {
              acc.push(item.category);
            }
            return acc;
          }, []);
          setCategories(uniqueCategories);

          const pages: PageState = {};
          uniqueCategories.forEach((category: string) => {
            pages[category] = 1;
          });
          setCurrentPage(pages);
        }
      }
    }
  }, [accessToken, cachedProducts, router]);

  const getProduct = (id: string) => {
    router.push(id);
  };

  const addToCart = async (product: Product) => {
    try {
      await axios.post('/api/cart/add', product, { headers: { Authorization: `Bearer ${accessToken}` } });
      dispatch(cartAction());
    } catch (err) {
      setError(prev => ({ ...prev, cart: "I'm sorry we're running into some problems" }));
    }
  };

  const handleNextPage = async (category: string) => {
    const startIndex = currentPage[category] * 3;
    const endIndex = startIndex + 3;
    setAtEnd(prev => ({ ...prev, [category]: false }));
    const cachedCategoryProducts = products.filter(product => product.category === category);
    if (endIndex <= cachedCategoryProducts.length) {
      setCurrentPage(prev => ({
        ...prev,
        [category]: (prev[category] || 1) + 1,
      }));
    } else {
      await getAllProducts(startIndex, endIndex);
      setCurrentPage(prev => ({
        ...prev,
        [category]: (prev[category] || 1) + 1,
      }));
    }
  };

  const handlePrevPage = (category: string) => {
    setAtEnd(prev => ({ ...prev, [category]: false }));
    setCurrentPage(prev => ({
      ...prev,
      [category]: Math.max((prev[category] || 2) - 1, 1),
    }));
  };

  const groupedProducts = categories.map(category => ({
    category,
    products: products.filter(product => product.category === category),
  }));

  return (
    <div className="container mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Stores</h1>
      </div>
      {error.product ? (
        <div>{error.product}</div>
      ) : (
        groupedProducts.map(group => {
          const startIndex = (currentPage[group.category] - 1) * 3;
          const paginatedProducts = group.products.slice(startIndex, startIndex + 3);
          if (!paginatedProducts.length) {
            setAtEnd(prev => ({ ...prev, [group.category]: true }));
            handlePrevPage(group.category);
          }
          return (
            <div key={group.category}>
              <h2 className="text-2xl font-semibold mb-4">{group.category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
                {paginatedProducts.map(item => (
                  <div key={item.uniqueId} className="bg-white shadow-md rounded-lg p-4 relative">
                    <div onClick={() => getProduct(item._id)} className="cursor-pointer grid place-items-center">
                      <img src={item.pic} alt={item.name} className="w-full h-48 object-cover rounded-t-md" />
                      <div className="mt-4">
                        <h2 className="text-xl font-semibold">{item.name}</h2>
                        <p className="text-gray-700">${item.price}</p>
                      </div>
                    </div>
                    {error.cart && <div>{error.cart}</div>}
                    <button className="bg-yellow-400 rounded p-2 text-white" onClick={() => addToCart(item)}>Add To Cart</button>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center">
                <button className="bg-gray-500 text-white px-4 py-2 rounded" onClick={() => handlePrevPage(group.category)} disabled={currentPage[group.category] === 1}>
                  Previous
                </button>
                <button className="bg-gray-500 text-white px-4 py-2 rounded" onClick={() => handleNextPage(group.category)} disabled={atEnd[group.category]}>
                  Next
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
