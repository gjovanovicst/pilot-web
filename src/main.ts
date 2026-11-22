import '../styles/base.css';
import './pages/SignIn.css';
import { EMPTY_STATE_ID, renderSignInPage } from './pages/SignIn.ts';

const root = document.querySelector<HTMLElement>('#root');

if (!root) {
  throw new Error('pilot-web: #root is missing from index.html');
}

root.innerHTML = renderSignInPage();

const form = root.querySelector<HTMLFormElement>('.sign-in__form');
const emptyState = root.querySelector<HTMLElement>(`#${EMPTY_STATE_ID}`);

if (form && emptyState) {
  const state = emptyState;

  // The empty state is shown on load and for as long as the form is untouched.
  const syncEmptyState = (): void => {
    const inputs = Array.from(form.elements).filter(
      (element): element is HTMLInputElement => element instanceof HTMLInputElement,
    );
    state.hidden = inputs.some((input) => input.value.trim() !== '');
  };

  form.addEventListener('input', syncEmptyState);
  form.addEventListener('reset', syncEmptyState);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });
}
