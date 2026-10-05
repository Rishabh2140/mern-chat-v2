import { useContext, useState } from 'react';
import axios from 'axios';
import { UserContext } from './UserContext.jsx';

function RegisterAndLoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isloginOrRegister, setIsLoginOrRegister] = useState('register');
    const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);
    const [errorMessage, setErrorMessage] = useState('');

    async function handleSubmit(ev) {
        ev.preventDefault();
        const url = isloginOrRegister === 'register' ? 'register' : 'login';

        try {
            const { data } = await axios.post(`/${url}`, { username, password }, {
                withCredentials: true, // send cookies
            });
            setLoggedInUsername(username);
            setId(data.id);
            setErrorMessage('');
        } catch (err) {
            console.error(err);
            // Handle specific HTTP status codes
            if (err.response?.status === 409) {
                setErrorMessage('Username already exists! Please choose another.');
            } else if (err.response?.status === 401) {
                setErrorMessage('Invalid username or password!');
            } else {
                setErrorMessage('An unexpected error occurred. Please try again.');
            }
        }
    }

    return (
        <div className='flex min-h-[100dvh] w-full items-center justify-center bg-blue-50 px-4 py-8'>
            <form className='w-full max-w-sm rounded-xl bg-white p-6 shadow-sm sm:p-8' onSubmit={handleSubmit}>
                <input
                    value={username}
                    onChange={ev => setUsername(ev.target.value)}
                    type='text'
                    placeholder='Username'
                    autoComplete='username'
                    className='mb-3 block min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-base focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
                />
                <input
                    value={password}
                    onChange={ev => setPassword(ev.target.value)}
                    type='password'
                    placeholder='Password'
                    autoComplete={isloginOrRegister === 'register' ? 'new-password' : 'current-password'}
                    className='mb-4 block min-h-11 w-full rounded-md border border-gray-200 px-3 py-2 text-base focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100'
                />
                <button className='block min-h-11 w-full rounded-md bg-blue-500 px-4 py-2 font-medium text-white hover:bg-blue-600'>
                    {isloginOrRegister === 'register' ? 'Register' : 'Login'}
                </button>

                {errorMessage && (
                    <div className="mt-3 break-words text-center text-sm text-red-500">
                        {errorMessage}
                    </div>
                )}

                {isloginOrRegister === 'register' && (
                    <div className="mt-4 text-center text-sm text-gray-600">
                        Already a member?{' '}
                        <button type="button" onClick={() => setIsLoginOrRegister('login')} className="min-h-10 px-1 font-medium text-blue-600">
                            Login Here
                        </button>
                    </div>
                )}

                {isloginOrRegister === 'login' && (
                    <div className="mt-4 text-center text-sm text-gray-600">
                        Don&apos;t have an account?{' '}
                        <button type="button" onClick={() => setIsLoginOrRegister('register')} className="min-h-10 px-1 font-medium text-blue-600">
                            Register
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}

export default RegisterAndLoginForm;
