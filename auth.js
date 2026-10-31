import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';

// Supabase publishable key is designed for browser use; row access is enforced in Postgres.
const client = createClient('https://gobsgtpgmaqueghwklll.supabase.co', 'sb_publishable_njxZPfGHlFVRiS-2kkz_TA_JiBZHehU');
const dialog = document.querySelector('#dialog');
const body = document.querySelector('#dialog-body');
const account = document.querySelector('#account');
const signup = document.querySelector('#signup');
let session = null;
let saved = new Set();

function alertText(element, message, isError = false) {
  element.textContent = message;
  element.className = isError ? 'auth-message error' : 'auth-message';
}
function setAccountLabel() {
  account.textContent = session ? 'Моё избранное ↗' : 'Войти ↗';
  signup.hidden = Boolean(session);
}
async function loadFavorites() {
  saved = new Set();
  if (!session) return;
  const { data, error } = await client.from('favorites').select('recipe_id');
  if (error) throw error;
  saved = new Set(data.map(row => row.recipe_id));
}
function openAccount(message = '', registerMode = false) {
  if (!dialog.open) dialog.showModal();
  if (session) { showFavorites(message); return; }
  body.innerHTML = `<h2 class="dialog-title">${registerMode ? 'Регистрация' : 'Рады вас видеть'}</h2><p class="dialog-text">Войдите или создайте аккаунт, чтобы сохранять любимые блюда.</p>
    <form id="auth-form" class="auth-form"><label>Электронная почта<input name="email" type="email" autocomplete="email" required></label>
    <label>Пароль<input name="password" type="password" autocomplete="${registerMode ? 'new-password' : 'current-password'}" minlength="6" required></label>
    <p class="auth-message" role="status"></p><button class="auth-primary" type="submit">${registerMode ? "Регистрация" : "Войти"}</button>
    <button class="auth-secondary" type="button" id="switch-auth">${registerMode ? "Уже есть аккаунт? Войти" : "Регистрация"}</button></form>`;
  const form = document.querySelector('#auth-form');
  const status = form.querySelector('[role=status]');
  if (message) alertText(status, message);
  async function submit(signUp) {
    if (!form.reportValidity()) return;
    if (location.protocol === 'file:') { alertText(status,'Для входа откройте опубликованную версию сайта через интернет.',true); return; }
    const email = form.email.value.trim(), password = form.password.value;
    form.querySelectorAll('button').forEach(b => b.disabled = true);
    alertText(status,'Подождите...');
    try {
      const result = signUp ? await client.auth.signUp({ email, password }) : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      form.password.value = '';
      if (signUp && !result.data.session) alertText(status,'Если регистрация доступна, проверьте почту для подтверждения адреса.');
      else if (result.data.session) { session = result.data.session; await loadFavorites(); setAccountLabel(); showFavorites(); }
    } catch (error) { alertText(status,'Не удалось выполнить вход или регистрацию. Проверьте данные и попробуйте ещё раз.',true); }
    finally { form.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); submit(registerMode); });
  document.querySelector('#switch-auth').addEventListener('click', () => openAccount('', !registerMode));
}
function showFavorites(message = '') {
  body.innerHTML = `<h2 class="dialog-title">Моё избранное</h2><p class="dialog-text" id="saved-summary"></p><ul class="saved-list"></ul><p class="auth-message" role="status"></p><button class="auth-secondary" id="signout">Выйти из аккаунта</button>`;
  const list = body.querySelector('.saved-list');
  const matches = recipes.filter(r => saved.has(r.url));
  body.querySelector('#saved-summary').textContent = matches.length ? 'Ваши сохранённые рецепты:' : 'Пока здесь пусто. Откройте рецепт и нажмите «В избранное».';
  for (const recipe of matches) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'saved-link'; button.textContent = recipe.title;
    button.addEventListener('click', () => { dialog.close(); show(recipe); });
    item.append(button); list.append(item);
  }
  if (message) alertText(body.querySelector('[role=status]'), message);
  body.querySelector('#signout').addEventListener('click', async () => {
    const {error} = await client.auth.signOut();
    if (error) { alertText(body.querySelector('[role=status]'),'Не удалось выйти. Попробуйте ещё раз.',true); return; }
    session = null; saved.clear(); setAccountLabel(); openAccount('Вы вышли из аккаунта.');
  });
}
function showSaveButton(recipeId) {
  const target = document.querySelector('#save-recipe');
  if (!target || target.dataset.recipeId !== recipeId) return;
  const button = document.createElement('button');
  button.className = 'auth-primary';
  button.textContent = saved.has(recipeId) ? '♥ Убрать из избранного' : '♡ В избранное';
  const status = document.createElement('p'); status.className = 'auth-message'; status.setAttribute('role','status');
  button.addEventListener('click', async () => {
    if (!session) { openAccount('Войдите, чтобы сохранить рецепт.'); return; }
    button.disabled = true;
    const remove = saved.has(recipeId);
    const {error} = remove
      ? await client.from('favorites').delete().eq('user_id', session.user.id).eq('recipe_id', recipeId)
      : await client.from('favorites').insert({user_id: session.user.id, recipe_id: recipeId});
    if (error) alertText(status,'Не удалось обновить избранное. Попробуйте ещё раз.',true);
    else { if (remove) saved.delete(recipeId); else saved.add(recipeId); button.textContent = remove ? '♡ В избранное' : '♥ Убрать из избранного'; alertText(status,remove ? 'Рецепт удалён из избранного.' : 'Рецепт сохранён.'); }
    button.disabled = false;
  });
  target.replaceChildren(button,status);
}
account.onclick = () => openAccount();
signup.onclick = () => openAccount('', true);
window.addEventListener('recipe:opened', event => showSaveButton(event.detail));
client.auth.onAuthStateChange((_event, next) => { session = next; setAccountLabel(); setTimeout(() => loadFavorites().catch(() => {}), 0); });
const { data, error } = await client.auth.getSession();
if (!error) { session = data.session; setAccountLabel(); try { await loadFavorites(); } catch {} }
