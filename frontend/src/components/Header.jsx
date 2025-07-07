import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';

function Header() {
    const navigate = useNavigate();

    const handleWriteClick = () => {
        navigate('/create');
    };

    return <div className="header">
            <div style={{ cursor: 'pointer' }} onClick={() => navigate('/') }>
                <img src="/images/logo.png" alt="logo" style={{ height: 50, objectFit: 'contain' }} />
            </div>
            <div className="write-button" onClick={handleWriteClick}> Write </div>
        </div>
}

export default Header;