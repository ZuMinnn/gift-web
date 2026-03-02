import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Gift, Lock, Loader2, Trophy, Frown, XCircle, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import '../index.css'; // Make sure styles are applied

export default function Game() {
    const [playerName, setPlayerName] = useState('');
    const [hasJoined, setHasJoined] = useState(false);
    const [boxes, setBoxes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userIp, setUserIp] = useState('');
    const [winnerFound, setWinnerFound] = useState(false);
    const [winnerName, setWinnerName] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({ title: '', message: '', type: 'info' });
    const [showGuide, setShowGuide] = useState(true);

    const showAlert = (title, message, type = 'info') => {
        setModalConfig({ title, message, type });
        setModalOpen(true);
    };

    useEffect(() => {
        // Get user IP
        const fetchIp = async () => {
            try {
                const res = await axios.get('https://api.ipify.org?format=json');
                setUserIp(res.data.ip);
            } catch (error) {
                console.error("Could not fetch IP", error);
                // Fallback or handle error
            }
        };
        fetchIp();

        // Listen to real-time updates for boxes
        const unsub = onSnapshot(collection(db, 'boxes'), (snapshot) => {
            const boxesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            boxesData.sort((a, b) => parseInt(a.id) - parseInt(b.id));

            setBoxes(boxesData);

            // Check if any box that is selected is the winner
            const winningBox = boxesData.find(b => b.locked && b.isWinner);
            if (winningBox) {
                setWinnerFound(true);
                setWinnerName(winningBox.selectedBy);
            }

            setLoading(false);
        });

        return () => unsub();
    }, []);

    const handleJoin = (e) => {
        e.preventDefault();
        if (playerName.trim()) {
            setHasJoined(true);
        }
    };

    const handleSelectBox = async (boxId) => {
        if (winnerFound) return; // Nếu đã có người trúng thì không cho mở nữa

        try {
            // 1. Kiểm tra IP xem đã chọn quà chưa
            const q = query(collection(db, 'players'), where("ip", "==", userIp));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                showAlert("Chú ý!", "Mỗi người chỉ được mở 1 hộp quà thôi nhé!", "warning");
                return;
            }

            // 2. Kiểm tra xem hộp đã bị người khác chọn chưa
            const boxRef = doc(db, 'boxes', boxId);
            const boxSnap = await getDoc(boxRef);
            if (boxSnap.exists() && boxSnap.data().locked) {
                showAlert("Chậm tay mất rồi!", "Hộp này đã được người khác chọn lúc nãy. Vui lòng chọn hộp khác nhé!", "warning");
                return;
            }

            const isThisBoxWinner = boxSnap.data().isWinner;

            // 3. Mở hộp và khóa lại
            await updateDoc(boxRef, {
                locked: true,
                selectedBy: playerName,
                selectedAt: new Date().toISOString()
            });

            // 4. Thêm người chơi vào danh sách kèm IP
            await setDoc(doc(db, 'players', userIp + '_' + Date.now().toString()), {
                name: playerName,
                ip: userIp,
                selectedBox: boxId,
                selectedAt: new Date().toISOString()
            });

            if (isThisBoxWinner) {
                showAlert("Tuyệt Vời!", `🎉 CHÚC MỪNG ${playerName.toUpperCase()}! BẠN ĐÃ TRÚNG THƯỞNG! 🎉`, "success");
            } else {
                showAlert("Rất Tiếc!", `Tiếc quá ${playerName}, hộp này không có phần thưởng.`, "error");
            }

        } catch (error) {
            console.error("Error selecting box:", error);
            showAlert("Lỗi!", "Có lỗi xảy ra, vui lòng thử lại!", "error");
        }
    };

    const GuideModal = () => {
        if (!showGuide) return null;
        return (
            <div className="modal-overlay" onClick={() => setShowGuide(false)}>
                <div className="modal-content info" onClick={e => e.stopPropagation()}>
                    <div className="modal-icon">
                        <Gift size={56} style={{ color: 'var(--primary)', animation: 'float 2s infinite ease-in-out' }} />
                    </div>
                    <h3>Hướng Dẫn Chơi 🎁</h3>
                    <div style={{ textAlign: 'left', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
                        <p>1️⃣ Nhập tên để tham gia.</p>
                        <p>2️⃣ Chọn <b>1 hộp quà duy nhất</b>.</p>
                        <p>3️⃣ Chỉ có <b>1 hộp trúng thưởng</b> </p>
                        <p> <i>Lưu ý: Mỗi người chơi chỉ được mở 1 hộp.</i></p>
                    </div>
                    <button className="btn-primary" onClick={() => setShowGuide(false)}>Đã hiểu, Chơi ngay!</button>
                </div>
            </div>
        );
    };

    if (!hasJoined) {
        return (
            <>
                <GuideModal />
                <div className="join-container">
                    <div className="glass-card" style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '2rem' }}>
                            <h1 style={{ marginBottom: 0, fontSize: '1.5rem' }}>🎁 Chọn Hộp Quà May Mắn 🎁</h1>
                            <p style={{ marginBottom: 0 }}>Nhập tên của bạn để bắt đầu chọn quà nhé!</p>
                        </div>
                        <form onSubmit={handleJoin} className="join-form">
                            <input
                                type="text"
                                placeholder="Nhập tên của bạn..."
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                required
                                className="name-input"
                            />
                            <button type="submit" className="btn-primary">Bắt đầu ngay</button>
                        </form>
                    </div>
                </div>
            </>
        );
    }

    if (loading) {
        return <div className="loading"><Loader2 className="spinner" /></div>;
    }

    // Check if current user's IP already selected a box
    // Since we subscribe to changes, this is local check. But DB enforces it too via exact IP query in logic above.

    const Modal = () => {
        if (!modalOpen) return null;
        return (
            <div className="modal-overlay" onClick={() => setModalOpen(false)}>
                <div className={`modal-content ${modalConfig.type}`} onClick={e => e.stopPropagation()}>
                    <div className="modal-icon">
                        {modalConfig.type === 'success' && <CheckCircle size={56} />}
                        {modalConfig.type === 'error' && <Frown size={56} />}
                        {modalConfig.type === 'warning' && <AlertCircle size={56} />}
                        {modalConfig.type === 'info' && <AlertCircle size={56} />}
                    </div>
                    <h3>{modalConfig.title}</h3>
                    <p>{modalConfig.message}</p>
                    <button className="btn-primary mt-4" onClick={() => setModalOpen(false)}>Đóng</button>
                </div>
            </div>
        );
    };

    return (
        <div className="game-container">
            <Modal />
            <header className="glass-header">
                <h2>Xin chào, <span className="highlight">{playerName}</span> 👋</h2>

                {winnerFound && (
                    <div className="winner-banner">
                        <h2>🏆 TRÒ CHƠI ĐÃ KẾT THÚC 🏆</h2>
                        <p>Người chiến thắng là: <strong className="highlight">{winnerName}</strong></p>
                    </div>
                )}

            </header>

            <div className="grid-container mt-4">
                {boxes.map(box => {
                    const isMine = box.selectedBy === playerName;
                    const isLocked = box.locked;
                    const isWinnerBox = isLocked && box.isWinner;

                    let boxClass = "box-card ";

                    if (winnerFound) {
                        if (isWinnerBox) {
                            boxClass += " winner-reveal "; // Hộp trúng nổi bật
                        } else {
                            boxClass += " dimmed "; // Các hộp khác tối đi
                        }
                    } else {
                        if (isMine) boxClass += " mine ";
                        else if (isLocked) boxClass += " locked dimmed-active "; // Tối đi khi bị mở nắp và k trúng thưởng
                        else boxClass += " available ";
                    }

                    return (
                        <div
                            key={box.id}
                            className={boxClass}
                            onClick={() => !isLocked && !winnerFound && handleSelectBox(box.id)}
                        >
                            <div className="box-content">
                                {isLocked ? (
                                    <>
                                        {isWinnerBox ? (
                                            <>
                                                <Trophy size={40} className="winner-icon" />
                                                <span className="box-number text-white">{box.id}</span>
                                                <span className="player-name bg-success font-bold">{box.selectedBy} - TRÚNG!</span>
                                            </>
                                        ) : (
                                            <>
                                                <Frown size={24} className="text-secondary opacity-50" />
                                                <span className="box-number opacity-50">{box.id}</span>
                                                <span className="player-name opacity-50">{isMine ? "Của bạn" : box.selectedBy}</span>
                                            </>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Gift size={40} className="gift-icon" />
                                        <span className="box-number">{box.id}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
