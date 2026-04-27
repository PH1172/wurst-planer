```react
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  collection, 
  addDoc, 
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';

// --- Icons ---
const IconUtensils = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
const IconUser = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconTrash = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const IconLock = ({ size = 24 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconShare = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>;
const IconClipboardList = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>;
const IconWallet = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;

// Firebase Konfiguration
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wurst-fruehstueck-v4';

const DEFAULT_LISTE = [
  { name: "Brötchen normal", price: 0.40 },
  { name: "Kaiserbrötchen", price: 0.45 },
  { name: "Weltmeisterbrötchen", price: 0.85 },
  { name: "Roggenbrötchen", price: 0.75 },
  { name: "Käsebrötchen", price: 1.10 },
  { name: "Wiener Würstchen", price: 1.50 },
  { name: "Knacker", price: 1.80 },
  { name: "Mettwurst", price: 1.50 },
  { name: "Salami", price: 1.90 },
  { name: "Leberwurst", price: 1.20 }
];

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const getWeekNumber = (d) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('orders'); 
  const [orders, setOrders] = useState([]);
  const [wurstData, setWurstData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showToast, setShowToast] = useState(false);
  const ADMIN_PASSWORD = "wurst123";

  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    wurstName: '',
    quantity: 1
  });

  // Initiale Wurstwahl setzen, sobald Daten da sind
  useEffect(() => {
    if (wurstData.length > 0 && !formData.wurstName) {
      setFormData(prev => ({ ...prev, wurstName: wurstData[0].name }));
    }
  }, [wurstData]);

  const dateInfo = useMemo(() => {
    const d = new Date(formData.date);
    if (isNaN(d.getTime())) return { day: '-', kw: '-' };
    return { day: WEEKDAYS[d.getDay()], kw: getWeekNumber(d) };
  }, [formData.date]);

  // Auth initialisieren (RULE 3)
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Fehler:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Firebase Daten-Sync (RULE 1 & 2)
  useEffect(() => {
    if (!user) return;
    
    const configDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings');
    const ordersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');

    // Erst prüfen, ob Config existiert, sonst Default setzen
    const checkConfig = async () => {
      const snap = await getDoc(configDocRef);
      if (!snap.exists()) {
        await setDoc(configDocRef, { wurstList: DEFAULT_LISTE });
      }
    };
    checkConfig();

    const unsubConfig = onSnapshot(configDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setWurstData(data.wurstList || DEFAULT_LISTE);
      }
    }, (err) => console.error("Config Sync Fehler:", err));

    const unsubOrders = onSnapshot(ordersColRef, (querySnap) => {
      const list = [];
      querySnap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setOrders(list);
      setLoading(false);
    }, (err) => console.error("Orders Sync Fehler:", err));

    return () => { unsubConfig(); unsubOrders(); };
  }, [user]);

  const priceMap = useMemo(() => {
    const map = {};
    wurstData.forEach(w => map[w.name] = w.price);
    return map;
  }, [wurstData]);

  const groupedOrders = useMemo(() => {
    const kwMap = {};
    orders.forEach(o => {
      const d = new Date(o.date);
      const kw = `KW ${getWeekNumber(d)} (${d.getFullYear()})`;
      const dateKey = o.date;
      if (!kwMap[kw]) kwMap[kw] = {};
      if (!kwMap[kw][dateKey]) kwMap[kw][dateKey] = [];
      kwMap[kw][dateKey].push(o);
    });

    return Object.keys(kwMap).sort().reverse().map(kw => ({
      kwLabel: kw,
      days: Object.keys(kwMap[kw]).sort().map(date => {
        const dayOrders = kwMap[kw][date];
        const dayTotal = dayOrders.reduce((sum, o) => sum + ((priceMap[o.wurstName] || 0) * (o.quantity || 1)), 0);
        const stats = dayOrders.reduce((acc, o) => {
          acc[o.wurstName] = (acc[o.wurstName] || 0) + (o.quantity || 1);
          return acc;
        }, {});
        return { 
          date, 
          dayName: WEEKDAYS[new Date(date).getDay()],
          orders: dayOrders, 
          total: dayTotal,
          stats 
        };
      })
    }));
  }, [orders, priceMap]);

  const handleSaveOrder = async (e) => {
    e.preventDefault();
    if (!user || !formData.name) return;
    try {
      const ordersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
      await addDoc(ordersColRef, { ...formData, createdAt: Date.now() });
      setFormData(prev => ({ ...prev, quantity: 1 })); 
    } catch (err) { console.error("Speicherfehler:", err); }
  };

  const copyLink = () => {
    const url = window.location.href;
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const formatEuro = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);

  if (loading) return <div className="flex h-screen items-center justify-center text-gray-400 font-sans italic">Verbindung zur Wurst-Cloud...</div>;

  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen flex flex-col font-sans pb-12 shadow-2xl relative">
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-6 py-3 rounded-full text-xs font-bold shadow-xl animate-bounce">
          Link kopiert!
        </div>
      )}

      <header className="bg-red-800 text-white p-6 shadow-md flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg"><IconUtensils /></div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase leading-none">Wurst-Planer</h1>
            <p className="text-[10px] text-red-200 font-bold uppercase tracking-widest mt-1">Frühstücks-Zentrale</p>
          </div>
        </div>
        <button onClick={copyLink} title="Link kopieren" className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors border border-white/10">
          <IconShare />
        </button>
      </header>

      <nav className="flex bg-white sticky top-0 z-20 border-b border-gray-100 shadow-sm">
        <button onClick={() => setView('orders')} className={`flex-1 py-4 text-[10px] font-black tracking-widest transition-all ${view === 'orders' ? 'text-red-700 border-b-4 border-red-700 bg-red-50/30' : 'text-gray-400'}`}>PLANUNG</button>
        <button onClick={() => setView('admin')} className={`flex-1 py-4 text-[10px] font-black tracking-widest transition-all ${view === 'admin' ? 'text-red-700 border-b-4 border-red-700 bg-red-50/30' : 'text-gray-400'}`}>ADMIN</button>
      </nav>

      <main className="p-4 flex-1">
        {view === 'orders' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-black text-gray-800 mb-5 flex items-center gap-2 uppercase tracking-tight"><IconUser /> Neue Bestellung</h2>
              <form onSubmit={handleSaveOrder} className="space-y-5">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase ml-1 mb-1 tracking-wider">Dein Name</label>
                  <input type="text" placeholder="Vorname" className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-100 focus:outline-none focus:ring-2 focus:ring-red-100 font-medium" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase ml-1 mb-1 tracking-wider">Datum</label>
                    <input type="date" className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-100 text-sm font-medium focus:outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                  </div>
                  <div className="flex flex-col justify-end pb-1 px-1">
                    <div className="text-red-600 font-black text-xs uppercase leading-none">{dateInfo.day}</div>
                    <div className="text-gray-400 text-[10px] font-bold uppercase mt-1">KW {dateInfo.kw}</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-gray-400 uppercase ml-1 mb-1 tracking-wider">Sorte</label>
                    <select className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-100 font-semibold focus:outline-none appearance-none text-gray-700" value={formData.wurstName} onChange={e => setFormData({...formData, wurstName: e.target.value})}>
                      {wurstData.map((w, i) => <option key={i} value={w.name}>{w.name} ({formatEuro(w.price)})</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-[9px] font-black text-gray-400 uppercase ml-1 mb-1 tracking-wider">Menge</label>
                    <input type="number" min="1" max="50" className="w-full p-3.5 bg-gray-50 rounded-2xl border border-gray-100 font-black text-center focus:outline-none" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} />
                  </div>
                </div>

                <button type="submit" className="w-full bg-red-700 hover:bg-red-800 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all uppercase text-xs tracking-widest">In Liste eintragen</button>
              </form>
            </section>

            {groupedOrders.length === 0 && (
              <div className="text-center py-10 opacity-30">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Noch keine Bestellungen</p>
              </div>
            )}

            {groupedOrders.map(group => (
              <div key={group.kwLabel} className="space-y-6">
                <div className="flex items-center gap-3 text-gray-300 px-1">
                  <div className="h-[1px] flex-1 bg-gray-200"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">{group.kwLabel}</span>
                  <div className="h-[1px] flex-1 bg-gray-200"></div>
                </div>

                {group.days.map(day => (
                  <div key={day.date} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <header className="bg-gray-50/50 p-4 border-b border-gray-50 flex justify-between items-center">
                      <div>
                        <h3 className="font-black text-gray-800 text-sm uppercase tracking-tight">{day.dayName}</h3>
                        <p className="text-[10px] text-gray-400 font-bold">{new Date(day.date).toLocaleDateString('de-DE')}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-red-700 font-black text-lg">{formatEuro(day.total)}</span>
                      </div>
                    </header>

                    <div className="p-4 bg-orange-50/30 border-b border-gray-50">
                      <div className="flex items-center gap-2 text-[9px] font-black text-orange-800 uppercase mb-3 tracking-wider"><IconClipboardList /> Gesamtbedarf</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(day.stats).map(([name, count]) => (
                          <div key={name} className="bg-white px-3 py-1.5 rounded-xl border border-orange-100 shadow-sm text-[11px] flex items-center gap-2">
                            <span className="font-black text-orange-700">{count}x</span>
                            <span className="font-bold text-gray-700">{name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {day.orders.map(o => (
                        <div key={o.id} className="p-4 flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center text-red-700 font-black text-xs">
                              {o.quantity}x
                            </div>
                            <div>
                              <div className="font-black text-gray-800 text-sm tracking-tight">{o.name}</div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase">{o.wurstName}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-gray-600">{formatEuro((priceMap[o.wurstName] || 0) * (o.quantity || 1))}</span>
                            {isAdminUnlocked && (
                              <button onClick={async () => await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id))} className="text-gray-200 hover:text-red-500 transition-colors p-1"><IconTrash /></button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            {!isAdminUnlocked ? (
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-gray-100 text-center">
                <IconLock size={40} className="mx-auto text-gray-300 mb-6" />
                <h2 className="font-black text-gray-800 mb-2 uppercase tracking-tight">Admin-Bereich</h2>
                <form onSubmit={(e) => { e.preventDefault(); if(passwordInput === ADMIN_PASSWORD) setIsAdminUnlocked(true); }} className="space-y-4">
                  <input type="password" placeholder="Passwort" className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center text-lg focus:outline-none" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} />
                  <button type="submit" className="w-full bg-gray-800 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest">Entsperren</button>
                  <p className="text-[9px] text-gray-300 italic">Passwort: wurst123</p>
                </form>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-50">
                   <h2 className="font-black text-gray-800 uppercase text-sm tracking-widest">Sorten & Preise</h2>
                   <button onClick={() => setIsAdminUnlocked(false)} className="text-[9px] font-black text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full uppercase">Logout</button>
                </div>
                <div className="space-y-3 mb-8">
                  {wurstData.map((w, i) => (
                    <div key={i} className="flex gap-3 items-center group">
                      <input type="text" value={w.name} onChange={(e) => {
                        const n = [...wurstData]; n[i].name = e.target.value; setWurstData(n);
                      }} className="flex-1 p-3 bg-gray-50 rounded-xl text-sm font-bold border border-transparent focus:bg-white" />
                      <div className="flex items-center gap-1 bg-gray-50 px-3 rounded-xl border border-transparent focus-within:border-green-100">
                        <IconWallet />
                        <input type="number" step="0.05" value={w.price} onChange={(e) => {
                          const n = [...wurstData]; n[i].price = parseFloat(e.target.value) || 0; setWurstData(n);
                        }} className="w-14 p-3 bg-transparent text-sm font-black text-green-700 focus:outline-none" />
                      </div>
                      <button onClick={() => setWurstData(wurstData.filter((_, idx) => idx !== i))} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash /></button>
                    </div>
                  ))}
                  <button onClick={() => setWurstData([...wurstData, { name: "Neu", price: 0.50 }])} className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-[10px] font-black text-gray-400 uppercase hover:border-red-100 hover:text-red-300 transition-colors">+ Sorte hinzufügen</button>
                </div>
                <button onClick={async () => {
                  await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'settings'), { wurstList: wurstData });
                  alert("Liste in der Cloud gespeichert!");
                }} className="w-full bg-green-700 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest mb-3 shadow-lg shadow-green-100">Liste Cloud-Sync</button>
                <div className="pt-6 mt-6 border-t border-gray-50">
                  <button onClick={async () => {
                    if(confirm("Alle Bestellungen löschen?")) {
                      for (const o of orders) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id));
                    }
                  }} className="w-full text-red-300 font-black py-2 text-[10px] uppercase tracking-[0.2em]">Verlauf leeren</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <footer className="text-center p-6"><p className="text-[9px] text-gray-300 font-black uppercase tracking-[0.3em]">WurstCloud v4.5.1 Cloud-First</p></footer>
    </div>
  );
}

```
