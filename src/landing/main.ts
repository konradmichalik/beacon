import '../app.css';
import './landing.css';
import Landing from './Landing.svelte';
import { mount } from 'svelte';

const appElement = document.getElementById('app');
if (!appElement) throw new Error('App element not found');

mount(Landing, { target: appElement });
