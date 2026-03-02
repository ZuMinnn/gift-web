import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Users, ShieldAlert, Loader2 } from 'lucide-react';

export default function Admin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [boxes, setBoxes] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    // Mật khẩu quản trị viên lấy từ file .env bảo mật
    const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

    useEffect(() => {
        if (!isAuthenticated) return;

        const unsubBoxes = onSnapshot(collection(db, 'boxes'), (snapshot) => {
            const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            boxesData.sort((a, b) => parseInt(a.id) - parseInt(b.id));
            setBoxes(boxesData);
            setLoading(false);
        });

        const unsubPlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            playersData.sort((a, b) => new Date(a.selectedAt) - new Date(b.selectedAt));
            setPlayers(playersData);
        });

        return () => {
            unsubBoxes();
            unsubPlayers();
        };
    }, [isAuthenticated]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
        } else {
            alert("Sai mật khẩu!");
        }
    };

    const handleSetWinner = async (boxId) => {
        try {
            // Đặt tất cả hộp về false
            for (const box of boxes) {
                if (box.isWinner) {
                    await updateDoc(doc(db, 'boxes', box.id), { isWinner: false });
                }
            }

            // Cài đặt hộp mới là winner
            await updateDoc(doc(db, 'boxes', boxId), { isWinner: true });
            alert(`Đã cài đặt hộp số ${boxId} là hộp trúng thưởng!`);
        } catch (e) {
            console.error(e);
            alert("Lỗi khi cài đặt trúng thưởng.");
        }
    };

    const initializeBoxes = async () => {
        try {
            setLoading(true);
            for (let i = 1; i <= 26; i++) {
                await setDoc(doc(db, 'boxes', i.toString()), {
                    locked: false,
                    selectedBy: null,
                    selectedAt: null,
                    isWinner: false
                });
            }
            alert("Đã khởi tạo 26 hộp quà trắng thành công!");
        } catch (e) {
            console.error(e);
            alert("Lỗi khởi tạo hộp quà.");
        } finally {
            setLoading(false);
        }
    };

    const clearAllPlayers = async () => {
        if (!window.confirm("Bạn có CHẮC CHẮN muốn xoá toàn bộ danh sách người chơi và reset quà đã chọn không?")) return;

        try {
            setLoading(true);

            // Xoá tất cả document trong collection players
            const querySnapshot = await getDocs(collection(db, 'players'));
            const deletePromises = [];
            querySnapshot.forEach((docSnap) => {
                deletePromises.push(deleteDoc(doc(db, 'players', docSnap.id)));
            });
            await Promise.all(deletePromises);

            // Mở khoá lại tất cả các hộp quà (nhưng giữ nguyên setup hộp trúng thưởng)
            for (const box of boxes) {
                if (box.locked) {
                    await updateDoc(doc(db, 'boxes', box.id), {
                        locked: false,
                        selectedBy: null,
                        selectedAt: null
                    });
                }
            }

            alert("Đã xoá danh sách người chơi và làm mới hộp quà!");
        } catch (e) {
            console.error(e);
            alert("Lỗi khi xoá người chơi.");
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="join-container">
                <div className="glass-card">
                    <ShieldAlert size={48} className="mb-4 text-warning" />
                    <h1>Admin Login</h1>
                    <form onSubmit={handleLogin} className="join-form">
                        <input
                            type="password"
                            placeholder="Nhập mật khẩu..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="name-input"
                        />
                        <button className="btn-primary" type="submit">Đăng nhập</button>
                    </form>
                </div>
            </div>
        );
    }

    if (loading) {
        return <div className="loading"><Loader2 className="spinner" /></div>;
    }

    return (
        <div className="admin-container">
            <div className="admin-header glass-card">
                <h1>Khu vực Quản Trị</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-outline text-warning" onClick={clearAllPlayers}>Xoá Người Chơi</button>
                    <button className="btn-danger" onClick={initializeBoxes}>Tạo Mới 26 Hộp</button>
                </div>
            </div>

            <div className="admin-stats mt-4">
                <div className="stat-card glass-card">
                    <h3><Users size={24} /> Người đã chọn</h3>
                    <div className="stat-value">{players.length}</div>
                </div>
                <div className="stat-card glass-card">
                    <h3>Hộp trúng thưởng</h3>
                    <div className="stat-value highlight">
                        {boxes.find(b => b.isWinner)?.id || "Chưa cài"}
                    </div>
                </div>
            </div>

            <div className="admin-main mt-4">
                <div className="glass-card table-container">
                    <h3>🏆 Danh sách Hộp & Trúng Thưởng</h3>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Hộp Số</th>
                                <th>Trạng thái</th>
                                <th>Người chọn</th>
                                <th>Trúng Thưởng</th>
                            </tr>
                        </thead>
                        <tbody>
                            {boxes.map(box => (
                                <tr key={box.id} className={box.isWinner ? 'winner-row' : ''}>
                                    <td><strong>{box.id}</strong></td>
                                    <td>{box.locked ? <span className="badge badge-locked">Đã chọn</span> : <span className="badge badge-avail">Trống</span>}</td>
                                    <td>{box.selectedBy || '-'}</td>
                                    <td>
                                        <button
                                            className={`btn-sm ${box.isWinner ? 'btn-success' : 'btn-outline'}`}
                                            onClick={() => handleSetWinner(box.id)}
                                        >
                                            {box.isWinner ? 'Đang trúng' : 'Đặt làm trúng thưởng'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="glass-card table-container">
                    <h3>👥 Danh sách Người chơi</h3>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Người chơi</th>
                                <th>Hộp số</th>
                                <th>Thời gian</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.length === 0 ? (
                                <tr><td colSpan="3" align="center">Chưa có người chơi nào.</td></tr>
                            ) : (
                                players.map(p => (
                                    <tr key={p.id}>
                                        <td>{p.name}</td>
                                        <td><strong>{p.selectedBox}</strong></td>
                                        <td>{p.selectedAt ? new Date(p.selectedAt).toLocaleTimeString() : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
