import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import './styles/index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { store } from './store';
import { restoreSessionThunk  } from './features/auth/authSlice';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

store.dispatch(restoreSessionThunk());

root.render(
    <React.StrictMode>
        <Provider store={store}>
            <App />
        </Provider>
    </React.StrictMode>
);

reportWebVitals();