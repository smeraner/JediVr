import { App } from './app';
import './main.css';

document.addEventListener("DOMContentLoaded", function(){
    const app = new App();
    app.init();
    window.app = app;
});