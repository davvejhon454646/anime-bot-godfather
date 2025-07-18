import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { findAnimeLinks } from './services/geminiService';
import { Message, TokenPackage } from './types';
import ChatMessage from './components/ChatMessage';
import SignUpScreen from './components/SignUpScreen';
import PaymentModal from './components/PaymentModal';
import PaymentPage from './components/PaymentPage';
import InboxModal from './components/InboxModal';
import { AuthContext } from './context/AuthContext';
import { NotificationContext } from './context/NotificationContext';

type View = 'chat' | 'payment';

const App: React.FC = () => {
    const { authState, spendToken, addTokens, claimDailyCredits, getLastClaimDate } = useContext(AuthContext);
    const { unreadCount } = useContext(NotificationContext);
    
    // App State
    const [messages, setMessages] = useState<Message[]>([
        { id: 'initial', sender: 'ai', text: "Hello! What anime are you looking for today? For example, you can ask me for 'Chainsaw Man episode 1'." }
    ]);
    const [userInput, setUserInput] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    
    // UI/View State
    const [view, setView] = useState<View>('chat');
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [isInboxOpen, setIsInboxOpen] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
    const [notificationMessage, setNotificationMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const [canClaimDaily, setCanClaimDaily] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Check if daily credits can be claimed
    useEffect(() => {
        const today = new Date().toDateString();
        const lastClaim = getLastClaimDate();
        setCanClaimDaily(lastClaim !== today && authState.tokens < 5);
    }, [authState.tokens, getLastClaimDate]);

    // Scroll to bottom of chat on new message
    useEffect(() => {
        if (view === 'chat' && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, view]);

    const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
        setNotificationMessage({ text, type });
        setTimeout(() => setNotificationMessage(null), 4000);
    }

    // Handle form submission to send a message
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = userInput.trim();
        if (!trimmedInput || isLoading) return;
        
        if (authState.tokens <= 0) {
            setPaymentModalOpen(true);
            return;
        }

        const userMessage: Message = { id: Date.now().toString(), text: trimmedInput, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsLoading(true);

        const loadingMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: loadingMessageId, sender: 'ai', text: '', isLoading: true }]);

        try {
            spendToken(); // Deduct token before making the call
            const chatHistory = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
            const response = await findAnimeLinks(trimmedInput, chatHistory);
            
            const aiMessage: Message = {
                id: (Date.now() + 2).toString(),
                text: response.responseText,
                sender: 'ai',
                links: response.foundLinks,
            };

            setMessages(prev => prev.filter(m => m.id !== loadingMessageId).concat(aiMessage));

        } catch (err) {
             const errorMessage = err instanceof Error ? err.message : "Sorry, I encountered an issue. Please try again.";
             setMessages(prev => prev.filter(m => m.id !== loadingMessageId));
             setMessages(prev => [...prev, { id: (Date.now() + 2).toString(), sender: 'ai', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    }, [userInput, isLoading, messages, authState.tokens, spendToken]);
    
    const handleClaimDaily = () => {
        const success = claimDailyCredits();
        if(success) {
            showNotification("Success! 3 daily tokens added.", 'success');
        } else {
             showNotification("You've either claimed today or have 5+ tokens.", 'error');
        }
        setCanClaimDaily(false);
    };

    // --- Payment Flow Handlers ---

    const handleInitiatePurchase = (pkg: TokenPackage) => {
        setSelectedPackage(pkg);
        setPaymentModalOpen(false); // Close modal when navigating
        setView('payment');
    };

    const handlePaymentSuccess = (tokensPurchased: number) => {
        addTokens(tokensPurchased);
        setView('chat');
        setSelectedPackage(null);
        showNotification(`Success! ${tokensPurchased.toLocaleString()} tokens added.`);
    };

    const handleCancelPayment = () => {
        setView('chat');
        setSelectedPackage(null);
    };


    // --- Render Logic ---

    if (!authState.isLoggedIn || !authState.userIdentifier) {
        return <SignUpScreen />;
    }

    if (view === 'payment' && selectedPackage) {
        return <PaymentPage 
            pkg={selectedPackage} 
            userIdentifier={authState.userIdentifier}
            userEmail={authState.email || ''}
            onPaymentSuccess={handlePaymentSuccess} 
            onCancel={handleCancelPayment} 
        />
    }

    return (
        <>
            <div className="relative flex flex-col h-screen font-sans bg-slate-200 dark:bg-slate-900 text-slate-800 dark:text-slate-200 overflow-hidden">
                <header className="flex items-center justify-between flex-wrap gap-y-2 text-center py-4 px-6 border-b border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md z-10">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                        AI <span className="text-orange-500">Anime</span> Finder
                    </h1>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden sm:block">User: {authState.userIdentifier}</span>
                        
                        <button 
                            onClick={() => setIsInboxOpen(true)}
                            className="relative text-slate-600 dark:text-slate-300 hover:text-orange-500 dark:hover:text-orange-400 p-2 rounded-full transition-colors"
                            aria-label="Open Inbox"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                         
                         <button 
                            onClick={handleClaimDaily}
                            disabled={!canClaimDaily}
                            className="text-xs sm:text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-full px-3 py-2 disabled:bg-slate-500 disabled:cursor-not-allowed transition-colors"
                        >
                            Get Daily 3 Credits
                        </button>
                        <div className="text-sm sm:text-base font-bold text-white bg-orange-500 rounded-full px-4 py-2">
                            Tokens: {authState.tokens}
                        </div>
                    </div>
                </header>

                <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 chat-scrollbar">
                    {messages.map((msg) => (
                        <ChatMessage key={msg.id} message={msg} />
                    ))}
                    {authState.tokens <= 0 && !isLoading && (
                        <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-lg animate-fade-in">
                            <p>You're out of tokens!</p>
                            <button onClick={() => setPaymentModalOpen(true)} className="mt-2 font-bold text-orange-600 dark:text-orange-400 hover:underline">
                                Click here to get more.
                            </button>
                        </div>
                    )}
                </main>

                <footer className="p-4 bg-white dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 z-10">
                    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex items-center gap-4">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder={isLoading ? "Waiting for response..." : authState.tokens > 0 ? "Ask for an anime or episode..." : "You're out of tokens!"}
                            disabled={isLoading || authState.tokens <= 0}
                            className="w-full p-3 bg-slate-100 dark:bg-slate-700 rounded-lg border-2 border-transparent focus:border-orange-500 focus:ring-orange-500 transition disabled:opacity-50"
                            aria-label="Your message"
                        />
                        <button type="submit" disabled={isLoading || !userInput.trim() || authState.tokens <= 0} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex-shrink-0">
                            Send
                        </button>
                    </form>
                </footer>
            </div>

            {/* Notification Toast */}
            {notificationMessage && (
                 <div className={`absolute top-20 right-4 text-white font-bold py-3 px-5 rounded-lg shadow-lg animate-fade-in z-30 ${notificationMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notificationMessage.text}
                </div>
            )}
            
            {/* Payment Modal */}
            {isPaymentModalOpen && <PaymentModal onClose={() => setPaymentModalOpen(false)} onInitiatePurchase={handleInitiatePurchase} />}

            {/* Inbox Modal */}
            {isInboxOpen && <InboxModal onClose={() => setIsInboxOpen(false)} />}
        </>
    );
};

export default App;