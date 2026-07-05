/**
 * Embedded Chat Widget Script
 *
 * Usage:
 * <script src="https://yourdomain.com/embed.js"></script>
 * <script>
 *   EmbeddedChat.init({
 *     agentId: 123,
 *     containerId: 'chat-container', // optional, defaults to 'embedded-chat-widget'
 *     width: '380px', // optional, defaults to '380px'
 *     height: '600px', // optional, defaults to '600px'
 *     baseUrl: 'https://yourdomain.com' // optional, defaults to script origin
 *   })
 * </script>
 */

(function () {
  'use strict';

  function getBaseUrl() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.indexOf('/embed.js') !== -1) {
        const url = new URL(src);
        return url.origin;
      }
    }
    return window.location.origin || 'https://yourdomain.com';
  }

  const defaults = {
    containerId: 'embedded-chat-widget',
    width: '380px',
    height: '600px',
    baseUrl: getBaseUrl(),
    agentId: null,
    borderRadius: '16px',
    logoUrl: '/embed-logo.png',
    buttonSize: '60px',
    iframePath: '/embed',
  };

  function EmbeddedChatWidget(config) {
    this.config = Object.assign({}, defaults, config);
    this.iframe = null;
    this.container = null;
    this.isOpen = false;
    this.button = null;
    this.popup = null;
    this.buttonId = 'embedded-chat-button-' + Date.now();
    this.popupId = 'embedded-chat-popup-' + Date.now();

    this.init();
  }

  EmbeddedChatWidget.prototype.init = function () {
    this.container = document.getElementById(this.config.containerId);

    if (!this.container) {
      // If no container is provided in the host page, create one automatically
      this.container = document.createElement('div');
      this.container.id = this.config.containerId;
      document.body.appendChild(this.container);
    }

    this.container.style.position = 'fixed';
    this.container.style.bottom = '20px';
    this.container.style.right = '20px';
    this.container.style.zIndex = '9999';

    this.createButton();
    this.createPopup();

    window.addEventListener(
      'message',
      function (event) {
        const normalizedBase = (this.config.baseUrl || '').replace(/\/$/, '');
        const normalizedOrigin = (event.origin || '').replace(/\/$/, '');
        if (normalizedOrigin !== normalizedBase) return;

        if (event.data && event.data.type === 'close-chat') this.close();

        if (event.data && event.data.type === 'chat-height') {
          this.iframe.style.height = event.data.height + 'px';
        }
      }.bind(this)
    );
  };

  EmbeddedChatWidget.prototype.createButton = function () {
    this.button = document.createElement('button');
    this.button.id = this.buttonId;
    this.button.setAttribute('aria-label', 'Open chat');
    this.button.setAttribute('type', 'button');

    this.button.style.cssText = `
      width: ${this.config.buttonSize};
      height: ${this.config.buttonSize};
      border-radius: 50%;
      background-color: #3BE2BE;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease-in-out;
      position: fixed;
      bottom: 20px;
      right: 20px;
      overflow: hidden;
      z-index: 10001;
    `;

    const logoImg = document.createElement('img');
    logoImg.src = this.config.baseUrl + this.config.logoUrl;
    logoImg.alt = 'Chat';
    logoImg.style.cssText = `
      width: 70%;
      height: 70%;
      object-fit: contain;
      pointer-events: none;
    `;
    logoImg.onerror = function () {
      this.button.textContent = '💬';
      this.button.style.fontSize = '24px';
    }.bind(this);

    this.button.appendChild(logoImg);

    this.button.addEventListener('mouseenter', function () {
      this.style.transform = 'scale(1.1)';
      this.style.boxShadow =
        '0 6px 16px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
    });

    this.button.addEventListener('mouseleave', function () {
      this.style.transform = 'scale(1)';
      this.style.boxShadow =
        '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
    });

    this.button.addEventListener(
      'click',
      function () {
        this.toggle();
      }.bind(this)
    );

    this.addPulseAnimation();

    this.container.appendChild(this.button);
  };

  EmbeddedChatWidget.prototype.createPopup = function () {
    this.popup = document.createElement('div');
    this.popup.id = this.popupId;

    const buttonBottom = 20;
    const buttonGap = 20;
    const popupBottom =
      parseInt(this.config.buttonSize) + buttonGap + buttonBottom;

    this.popup.style.cssText = `
      position: fixed;
      bottom: ${popupBottom}px;
      right: 20px;
      width: ${this.config.width};
      height: ${this.config.height};
      max-width: calc(100vw - 40px);
      max-height: calc(100dvh - ${popupBottom + 20}px);
      border-radius: ${this.config.borderRadius};
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.2);
      background: black;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 9998;
    `;

    this.iframe = document.createElement('iframe');
    this.iframe.id = 'embedded-chat-iframe-' + Date.now();
    const iframeUrl = new URL(this.config.iframePath, this.config.baseUrl);
    if (this.config.agentId)
      iframeUrl.searchParams.set('agentId', String(this.config.agentId));
    this.iframe.src = iframeUrl.toString();
    this.iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      display: block;
      border-radius: ${this.config.borderRadius};
    `;
    this.iframe.setAttribute('allow', 'microphone; camera');
    this.iframe.setAttribute('allowfullscreen', 'true');
    this.iframe.setAttribute('scrolling', 'no');

    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'embedded-chat-loading-' + Date.now();
    loadingDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      pointer-events: none;
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
    `;
    loadingDiv.textContent = 'Loading...';

    this.popup.appendChild(this.iframe);
    this.popup.appendChild(loadingDiv);

    this.iframe.onload = function () {
      const loadingElement = this.popup.querySelector('#' + loadingDiv.id);
      if (loadingElement) loadingElement.remove();
    }.bind(this);

    this.container.appendChild(this.popup);
  };

  EmbeddedChatWidget.prototype.addPulseAnimation = function () {
    if (!document.getElementById('embedded-chat-styles')) {
      const style = document.createElement('style');
      style.id = 'embedded-chat-styles';
      style.textContent = `
        @keyframes embedded-chat-pulse {
          0%, 100% { transform: scale(1) }
          50% { transform: scale(1.05) }
        }
      `;
      document.head.appendChild(style);
    }

    this.button.style.animation = 'embedded-chat-pulse 2s ease-in-out infinite';

    if (!document.getElementById('embedded-chat-mobile-styles')) {
      const mobileStyle = document.createElement('style');
      mobileStyle.id = 'embedded-chat-mobile-styles';
      mobileStyle.textContent = `
        @media (max-width: 1024px) and (min-width: 769px) {
          [id^="embedded-chat-popup-"] {
            width: 90% !important;
            max-width: 400px !important;
            right: 20px !important;
            left: auto !important;
          }
        }

        @media (max-width: 768px) {
          [id^="embedded-chat-popup-"] {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            top: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            z-index: 9998 !important;
          }
          [id^="embedded-chat-popup-"] iframe { border-radius: 0 !important }
        }

        @media (max-width: 480px) {
          [id^="embedded-chat-popup-"] {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            top: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          [id^="embedded-chat-popup-"] iframe { border-radius: 0 !important }
        }

        @media (max-width: 768px) and (orientation: landscape) {
          [id^="embedded-chat-popup-"] {
            width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            bottom: 0 !important;
            top: 0 !important;
            border-radius: 0 !important;
          }
          [id^="embedded-chat-popup-"] iframe { border-radius: 0 !important }
        }

        @media (max-width: 768px) {
          .embedded-chat-container-open [id^="embedded-chat-button-"] {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(mobileStyle);
    }
  };

  EmbeddedChatWidget.prototype.open = function () {
    if (this.isOpen) return;
    this.isOpen = true;

    this.popup.style.opacity = '1';
    this.popup.style.transform = 'translateY(0) scale(1)';
    this.popup.style.pointerEvents = 'auto';
    this.popup.classList.add('embedded-chat-open');
    if (this.container)
      this.container.classList.add('embedded-chat-container-open');

    if (this.button) this.button.style.animation = 'none';
  };

  EmbeddedChatWidget.prototype.close = function () {
    if (!this.isOpen) return;
    this.isOpen = false;

    this.popup.style.opacity = '0';
    this.popup.style.transform = 'translateY(20px) scale(0.95)';
    this.popup.style.pointerEvents = 'none';
    this.popup.classList.remove('embedded-chat-open');
    if (this.container)
      this.container.classList.remove('embedded-chat-container-open');

    if (this.button)
      this.button.style.animation =
        'embedded-chat-pulse 2s ease-in-out infinite';
  };

  EmbeddedChatWidget.prototype.toggle = function () {
    if (this.isOpen) this.close();
    else this.open();
  };

  EmbeddedChatWidget.prototype.destroy = function () {
    if (this.container) this.container.innerHTML = '';
    this.iframe = null;
    this.container = null;
  };

  window.EmbeddedChat = {
    init: function (config) {
      return new EmbeddedChatWidget(config);
    },
    create: function (agentId, containerId) {
      return new EmbeddedChatWidget({
        agentId: agentId,
        containerId: containerId || defaults.containerId,
      });
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  function autoInit() {
    const containers = document.querySelectorAll(
      '[data-embedded-chat-agent-id], [data-embedded-chat-auto-init]'
    );
    containers.forEach(function (container) {
      const agentId = container.getAttribute('data-embedded-chat-agent-id');
      const width =
        container.getAttribute('data-embedded-chat-width') || defaults.width;
      const height =
        container.getAttribute('data-embedded-chat-height') || defaults.height;
      const baseUrl =
        container.getAttribute('data-embedded-chat-base-url') ||
        defaults.baseUrl;
      const iframePath =
        container.getAttribute('data-embedded-chat-iframe-path') ||
        defaults.iframePath;

      if (!container.id) container.id = 'embedded-chat-widget-' + Date.now();

      window.EmbeddedChat.init({
        agentId: agentId,
        containerId: container.id,
        width: width,
        height: height,
        baseUrl: baseUrl,
        iframePath: iframePath,
      });
    });
  }
})();
