// 간단한 로컬 인증 모듈
// localStorage 키: auth_users, auth_session
(function(global){
  const USERS_KEY = 'auth_users';
  const SESSION_KEY = 'auth_session';

  function readUsers(){
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }
  function writeUsers(users){
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  function readSession(){
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function writeSession(session){
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }

  // 초기 테스트 계정 시드: id(test), password(1234)
  (function seed(){
    const users = readUsers();
    // tsst 계정이 이미 저장돼 있으면 제거
    const filtered = users.filter(u => (u.email||'').toLowerCase() !== 'test');
    if (!filtered.find(u => (u.email||'').toLowerCase() === 'test')){
      filtered.push({ name: '테스트', email: 'test', password: '1234' });
    }
    writeUsers(filtered);
  })();

  const Auth = {
    getUsers: readUsers,
    getSession: readSession,
    signup({name, email, password}){
      const users = readUsers();
      const key = (email||'').toLowerCase();
      if (!key || !password) return false;
      if (users.find(u => (u.email||'').toLowerCase() === key)) return false;
      users.push({ name: name||'', email: key, password: String(password) });
      writeUsers(users);
      return true;
    },
    login(email, password){
      const key = (email||'').toLowerCase();
      const users = readUsers();
      const found = users.find(u => (u.email||'').toLowerCase() === key && String(u.password) === String(password));
      if (found){
        writeSession({ email: found.email, name: found.name });
        return true;
      }
      return false;
    },
    logout(){ writeSession(null); }
  };

  global.Auth = Auth;
})(window);
