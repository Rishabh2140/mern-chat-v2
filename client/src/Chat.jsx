import { useContext, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { UserContext } from "./UserContext.jsx";
import { uniqBy } from "lodash";
import axios from "axios";
import Contact from "./Contact";

const MAX_MEDIA_SIZE_BYTES = 1024 * 1024;

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [newMessageText, setNewMessageText] = useState('');
    const [attachmentError, setAttachmentError] = useState('');
    const [messages, setMessages] = useState([]);
    const { username, id, setId, setUsername } = useContext(UserContext);
    const divUnderMessages = useRef();
    const selectedUserIdRef = useRef(selectedUserId);
    selectedUserIdRef.current = selectedUserId;

    useEffect(() => {
        let active = true;
        let reconnectTimeout;
        let connection;

        function connectToWs() {
            if (!active) return;

            const websocketUrl = new URL(axios.defaults.baseURL);
            websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
            const nextConnection = new WebSocket(websocketUrl);
            connection = nextConnection;
            setWs(nextConnection);
            nextConnection.addEventListener('open', () => {
                if (active) setConnectionStatus('connected');
            });
            nextConnection.addEventListener('message', ev => {
                const messageData = JSON.parse(ev.data);
                if ('online' in messageData) {
                    const people = {};
                    messageData.online.forEach(({ userId, username }) => {
                        people[userId] = username;
                    });
                    setOnlinePeople(people);
                } else if ('text' in messageData && messageData.sender === selectedUserIdRef.current) {
                    setMessages(prev => ([...prev, { ...messageData }]));
                } else if (messageData.error) {
                    setAttachmentError(messageData.error);
                }
            });
            nextConnection.addEventListener('close', () => {
                if (!active) return;
                setWs(null);
                setConnectionStatus('reconnecting');
                reconnectTimeout = window.setTimeout(connectToWs, 1000);
            });
        }

        connectToWs();
        return () => {
            active = false;
            window.clearTimeout(reconnectTimeout);
            connection?.close();
        };
    }, []);

    function logout() {
        axios.post('/logout').then(() => {
            setWs(null);
            setId(null);
            setUsername(null);
        });
    }

    function sendMessage(ev, file = null) {
        if (ev) ev.preventDefault();
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({
            recipient: selectedUserId,
            text: newMessageText,
            file,
        }));
        if (file) {
            axios.get('/messages/' + selectedUserId).then(res => {
                setMessages(res.data);
            });
        } else {
            setNewMessageText('');
            setMessages(prev => ([...prev, {
                text: newMessageText,
                sender: id,
                recipient: selectedUserId,
                _id: Date.now(),
            }]));
        }
    }

    function sendFile(ev) {
        const file = ev.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_MEDIA_SIZE_BYTES) {
            setAttachmentError('Files must be 1 MB or smaller.');
            ev.target.value = '';
            return;
        }

        setAttachmentError('');
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            sendMessage(null, {
                name: file.name,
                data: reader.result,
            });
            ev.target.value = '';
        };
        reader.onerror = () => setAttachmentError('Could not read this file. Please try again.');
    }

    useEffect(() => {
        const div = divUnderMessages.current;
        if (div) {
            div.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                .filter(p => p._id !== id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeople = {};
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p;
            });
            setOfflinePeople(offlinePeople);
        });
    }, [onlinePeople, id]);

    useEffect(() => {
        if (selectedUserId) {
            axios.get('/messages/' + selectedUserId).then(res => {
                setMessages(res.data);
            });
        }
    }, [selectedUserId]);

    const onlinePeopleExclOurUser = { ...onlinePeople };
    delete onlinePeopleExclOurUser[id];

    const messagesWithoutDupes = uniqBy(messages, '_id');
    const selectedUsername = onlinePeopleExclOurUser[selectedUserId]
        || offlinePeople[selectedUserId]?.username;
    const isConnected = connectionStatus === 'connected' && ws?.readyState === WebSocket.OPEN;

    return (
        <main className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-white text-gray-800">
            <aside className={`flex w-full min-w-0 flex-col md:w-80 md:shrink-0 lg:w-96 ${selectedUserId ? 'hidden' : 'flex'} md:flex`}>
                <div className="shrink-0 border-b border-gray-100">
                    <Logo />
                </div>
                {!isConnected && (
                    <div role="status" className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                        {connectionStatus === 'connecting' ? 'Connecting to chat…' : 'Reconnecting to chat…'}
                    </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {Object.keys(onlinePeopleExclOurUser).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={true}
                            username={onlinePeopleExclOurUser[userId]}
                            onClick={() => setSelectedUserId(userId)}
                            selected={userId === selectedUserId} />
                    ))}
                    {Object.keys(offlinePeople).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={false}
                            username={offlinePeople[userId].username}
                            onClick={() => setSelectedUserId(userId)}
                            selected={userId === selectedUserId} />
                    ))}
                </div>
                <div className="flex shrink-0 items-center justify-between border-t border-gray-100 px-4 py-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate">{username}</span>
                    </span>
                    <button onClick={logout} className="shrink-0 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-gray-600">
                        Log out
                    </button>
                </div>
            </aside>
            <section className={`min-w-0 flex-1 flex-col bg-blue-50 ${selectedUserId ? 'flex' : 'hidden'} md:flex`}>
                {selectedUserId ? (
                    <>
                        <header className="flex shrink-0 items-center gap-3 border-b border-blue-100 bg-white px-3 py-2.5 sm:px-5">
                            <button
                                type="button"
                                onClick={() => setSelectedUserId(null)}
                                aria-label="Back to contacts"
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-gray-600 hover:bg-gray-100 md:hidden">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                                </svg>
                            </button>
                            <Avatar online={!!onlinePeopleExclOurUser[selectedUserId]} username={selectedUsername || ''} userId={selectedUserId} />
                            <div className="min-w-0">
                                <h1 className="truncate text-sm font-semibold text-gray-800">{selectedUsername || 'Conversation'}</h1>
                                <p className="text-xs text-gray-500">{onlinePeopleExclOurUser[selectedUserId] ? 'Online' : 'Offline'}</p>
                            </div>
                        </header>
                        {!isConnected && (
                            <div role="status" className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
                                {connectionStatus === 'connecting' ? 'Connecting to chat…' : 'Reconnecting to chat…'}
                            </div>
                        )}
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
                            {messagesWithoutDupes.map(message => (
                                <div key={message._id} className={`flex ${message.sender === id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`my-1 max-w-[88%] break-words rounded-xl px-3 py-2 text-sm sm:max-w-[75%] ${message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 shadow-sm'}`}>
                                        {message.text}
                                        {message.file && (
                                            <a target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 break-all border-b border-current/30" href={axios.defaults.baseURL + '/uploads/' + message.file}>
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
                                                    <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                                                </svg>
                                                {message.file}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={divUnderMessages}></div>
                        </div>
                        {attachmentError && (
                            <p role="alert" className="shrink-0 px-3 pt-2 text-sm text-red-600 sm:px-5">{attachmentError}</p>
                        )}
                        <form className="flex shrink-0 items-center gap-2 border-t border-blue-100 bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" onSubmit={sendMessage}>
                            <input type="text"
                                value={newMessageText}
                                onChange={ev => setNewMessageText(ev.target.value)}
                                placeholder="Type a message"
                                aria-label="Message"
                                className="h-11 min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 text-base focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" />
                            <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-blue-100 bg-blue-50 text-gray-600 hover:bg-blue-100" aria-label="Attach a file">
                                <input type="file" className="sr-only" onChange={sendFile} disabled={!isConnected} />
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                    <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                                </svg>
                            </label>
                            <button type="submit" aria-label="Send message" disabled={!isConnected} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                </svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="hidden flex-1 items-center justify-center text-sm text-gray-400 md:flex">
                        Select a contact to start chatting
                    </div>
                )}
            </section>
        </main>
    );
}