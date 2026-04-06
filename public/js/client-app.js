(function () {
    const cartStorageKey = `arum_cart_${window.CLIENT_CONTEXT.uniqueIdentifier}`;
    const orderStorageKey = `arum_latest_order_${window.CLIENT_CONTEXT.uniqueIdentifier}`;

    const state = {
        bootstrap: null,
        cart: JSON.parse(localStorage.getItem(cartStorageKey) || '{}'),
        selectedCategory: 'all',
        search: '',
        latestOrderId: localStorage.getItem(orderStorageKey) || '',
        darkMode: localStorage.getItem('arum_dark_mode') !== 'false',
        language: localStorage.getItem('arum_language') || 'id',
        wishlist: JSON.parse(localStorage.getItem('arum_wishlist') || '[]'),
        estimate: null,
        customer: null,
        installPrompt: null,
        estimateTimeout: null,
        cartOpen: false,
        serviceMenuOpen: false,
    };

    const text = {
        id: {
            search: 'Cari menu, barcode, atau kategori',
            checkout: 'Kirim Pesanan',
            empty: 'Belum ada item di keranjang.',
            queued: 'Pesanan sudah masuk ke antrian dapur.',
            callWaiter: 'Panggil pelayan',
            askBill: 'Minta tagihan',
            cleanTable: 'Bersihkan meja',
            paymentCashier: 'Bayar di kasir',
            paymentTable: 'Bayar dari meja',
            paymentQris: 'QRIS',
        },
        en: {
            search: 'Search menu, barcode, or category',
            checkout: 'Place Order',
            empty: 'Your cart is still empty.',
            queued: 'Your order is already in kitchen queue.',
            callWaiter: 'Call waiter',
            askBill: 'Ask for bill',
            cleanTable: 'Clean table',
            paymentCashier: 'Pay at cashier',
            paymentTable: 'Pay from table',
            paymentQris: 'QRIS',
        },
    };

    const els = {};

    const currency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
    const t = (key) => text[state.language]?.[key] || text.id[key] || key;

    function cacheDom() {
        [
            'searchInput', 'categoryRow', 'productList', 'emptyProducts', 'cartLines', 'cartEmpty',
            'subtotalValue', 'discountValue', 'serviceValue', 'taxValue', 'roundingValue', 'totalValue', 'checkoutBtn',
            'customerName', 'customerPhone', 'customerEmail', 'orderNote', 'voucherCode', 'statusCard', 'statusBadge',
            'statusText', 'tableBadge', 'heroTitle', 'heroSubtitle', 'miniOutlet', 'miniTable',
            'miniTax', 'miniService', 'themeToggle', 'languageToggle', 'serviceActionRow', 'latestOrderMeta',
            'installBtn', 'cartCount', 'cartMeta', 'diningOption', 'feedbackBtn', 'recommendationRow',
            'promoRow', 'memberCard', 'memberTierBadge', 'memberNameValue', 'memberPointsValue',
            'memberCodeValue', 'paymentPreference', 'paymentPreferenceLabel', 'diningOptionLabel',
            'takeawayAddress', 'refreshStatusBtn', 'shareOrderBtn', 'statusOrderCode', 'statusQueueInfo',
            'floatingCart', 'cartSheet', 'cartBackdrop', 'cartToggleBtn', 'cartToggleSummary', 'cartCloseBtn',
            'serviceMenuBtn', 'openServicePanelBtn', 'serviceBackdrop', 'serviceDrawer', 'serviceCloseBtn', 'clientLoadingOverlay', 'clientLoadingText'
        ].forEach((id) => {
            els[id] = document.getElementById(id);
        });
    }

    function persistState() {
        localStorage.setItem('arum_wishlist', JSON.stringify(state.wishlist));
        localStorage.setItem('arum_dark_mode', state.darkMode ? 'true' : 'false');
        localStorage.setItem('arum_language', state.language);
        localStorage.setItem(cartStorageKey, JSON.stringify(state.cart));
        if (state.latestOrderId) {
            localStorage.setItem(orderStorageKey, state.latestOrderId);
        }
    }

    function setBodyMode() {
        document.body.classList.toggle('light-mode', !state.darkMode);
    }

    function getCartItems() {
        return Object.values(state.cart);
    }

    function findProduct(productId) {
        return state.bootstrap?.products?.find((product) => product._id === productId);
    }

    function getFilteredProducts() {
        return (state.bootstrap?.products || []).filter((product) => {
            const matchesCategory = state.selectedCategory === 'all' || product.category === state.selectedCategory;
            const haystack = `${product.name} ${product.description || ''} ${product.barcode || ''} ${product.category}`.toLowerCase();
            const matchesSearch = !state.search || haystack.includes(state.search.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }

    function paymentPreferenceLabel(value) {
        if (value === 'pay_at_table') return t('paymentTable');
        if (value === 'qris') return t('paymentQris');
        return t('paymentCashier');
    }

    function diningLabel(value) {
        return value === 'takeaway' ? 'Take Away' : 'Dine In';
    }

    function ensureCartItem(product) {
        if (!state.cart[product._id]) {
            state.cart[product._id] = {
                productId: product._id,
                name: product.name,
                quantity: 0,
                unitPrice: product.price,
                note: '',
                modifiers: {
                    variants: [],
                    addOns: [],
                    sweetness: product.sweetnessLevels?.[0] || 'Normal',
                    ice: product.iceLevels?.[0] || 'Normal',
                    spice: product.spiceLevels?.[0] || 'Normal',
                },
            };
        }
        return state.cart[product._id];
    }

    function scheduleEstimate() {
        clearTimeout(state.estimateTimeout);
        state.estimateTimeout = setTimeout(estimateOrder, 250);
    }

    function updateCart(productId, delta) {
        const product = findProduct(productId);
        if (!product) return;

        const item = ensureCartItem(product);
        item.quantity += delta;

        if (item.quantity <= 0) {
            delete state.cart[productId];
        }

        persistState();
        renderProducts();
        renderCart();
        scheduleEstimate();
    }

    function customizeItem(productId) {
        const product = findProduct(productId);
        if (!product) return;
        const item = ensureCartItem(product);

        const note = window.prompt(`Catatan untuk ${product.name}`, item.note || '');
        if (note !== null) item.note = note;

        if (product.addOns?.length) {
            const currentAddOns = item.modifiers.addOns.map((addOn) => addOn.name).join(', ');
            const addOnsInput = window.prompt(
                `Add-on tersedia: ${product.addOns.map((addOn) => `${addOn.name} (+${currency(addOn.price)})`).join(', ')}`,
                currentAddOns
            );
            if (addOnsInput !== null) {
                const selectedNames = addOnsInput
                    .split(',')
                    .map((value) => value.trim().toLowerCase())
                    .filter(Boolean);
                item.modifiers.addOns = product.addOns.filter((addOn) => selectedNames.includes(addOn.name.toLowerCase()));
            }
        }

        if (product.sweetnessLevels?.length > 1) {
            const sweetness = window.prompt(`Level gula: ${product.sweetnessLevels.join(', ')}`, item.modifiers.sweetness);
            if (sweetness) item.modifiers.sweetness = sweetness;
        }
        if (product.iceLevels?.length > 1) {
            const ice = window.prompt(`Level es: ${product.iceLevels.join(', ')}`, item.modifiers.ice);
            if (ice) item.modifiers.ice = ice;
        }
        if (product.spiceLevels?.length > 1) {
            const spice = window.prompt(`Level pedas: ${product.spiceLevels.join(', ')}`, item.modifiers.spice);
            if (spice) item.modifiers.spice = spice;
        }

        persistState();
        renderCart();
        scheduleEstimate();
    }

    function toggleWishlist(productId) {
        state.wishlist = state.wishlist.includes(productId)
            ? state.wishlist.filter((id) => id !== productId)
            : [...state.wishlist, productId];
        persistState();
        renderProducts();
        renderRecommendations();
    }

    function renderCategories() {
        els.categoryRow.innerHTML = '';
        const categories = [{ name: 'all', label: 'Semua' }, ...(state.bootstrap?.categories || []).map((category) => ({ name: category.name, label: category.name }))];
        categories.forEach((category) => {
            const button = document.createElement('button');
            button.className = `category-chip ${state.selectedCategory === category.name ? 'active' : ''}`;
            button.textContent = category.label;
            button.onclick = () => {
                state.selectedCategory = category.name;
                renderCategories();
                renderProducts();
            };
            els.categoryRow.appendChild(button);
        });
    }

    function renderPromos() {
        els.promoRow.innerHTML = '';
        const promos = state.bootstrap?.promos || [];
        if (!promos.length) {
            els.promoRow.innerHTML = '<div class="promo-pill"><div class="muted">Belum ada promo aktif.</div></div>';
            return;
        }

        promos.forEach((promo) => {
            const pill = document.createElement('div');
            pill.className = 'promo-pill';
            pill.innerHTML = `
                <div class="muted">${promo.code}</div>
                <strong>${promo.title}</strong>
                <div class="muted" style="margin-top:6px;">${promo.description || 'Promo aktif untuk meja ini.'}</div>
            `;
            pill.addEventListener('click', () => {
                els.voucherCode.value = promo.code;
                scheduleEstimate();
            });
            els.promoRow.appendChild(pill);
        });
    }

    function renderRecommendations() {
        els.recommendationRow.innerHTML = '';
        const sourceProducts = [...(state.bootstrap?.products || [])]
            .filter((product) => product.bestSeller || state.wishlist.includes(product._id) || product.featured)
            .slice(0, 8);

        if (!sourceProducts.length) {
            const placeholder = document.createElement('div');
            placeholder.className = 'soft-pill';
            placeholder.textContent = 'Rekomendasi menu akan muncul di sini.';
            els.recommendationRow.appendChild(placeholder);
            return;
        }

        sourceProducts.forEach((product) => {
            const button = document.createElement('button');
            button.className = 'action-chip';
            button.type = 'button';
            button.textContent = `${product.name} - ${currency(product.price)}`;
            button.addEventListener('click', () => updateCart(product._id, 1));
            els.recommendationRow.appendChild(button);
        });
    }

    function renderServiceActions() {
        els.serviceActionRow.innerHTML = '';
        const options = state.bootstrap?.settings?.callWaiterOptions?.length
            ? state.bootstrap.settings.callWaiterOptions
            : ['Panggil pelayan', 'Minta tagihan', 'Bersihkan meja'];

        options.forEach((option) => {
            const button = document.createElement('button');
            button.className = 'action-chip';
            button.type = 'button';
            button.dataset.type = option;
            button.textContent = option;
            button.addEventListener('click', () => callService(option));
            els.serviceActionRow.appendChild(button);
        });
    }

    function renderProducts() {
        const products = getFilteredProducts();
        els.productList.innerHTML = '';
        els.emptyProducts.classList.toggle('hidden', products.length > 0);

        products.forEach((product) => {
            const quantity = state.cart[product._id]?.quantity || 0;
            const liked = state.wishlist.includes(product._id);
            const card = document.createElement('div');
            card.className = 'product-card card';

            const bundleText = product.bundleSuggestions?.length ? product.bundleSuggestions[0] : '';
            const allergens = product.allergens?.length ? product.allergens.join(', ') : 'Tidak ada info';
            const coverStyle = product.imageUrl ? `style="background-image:url('${product.imageUrl}')"` : '';

            card.innerHTML = `
                <div class="product-cover" ${coverStyle}></div>
                <div class="product-top">
                    <div>
                        <div class="product-name">${product.name}</div>
                        <div class="product-description">${product.description || ''}</div>
                    </div>
                    <button class="icon-btn favorite-btn" type="button"><i class="fa-${liked ? 'solid' : 'regular'} fa-star"></i></button>
                </div>
                <div class="product-meta">
                    <span class="product-tag">${product.category}</span>
                    ${product.bestSeller ? '<span class="product-tag">Best Seller</span>' : ''}
                    ${product.isLowStock ? '<span class="product-tag">Stok Menipis</span>' : ''}
                    <span class="product-tag">Alergen: ${allergens}</span>
                </div>
                <div class="price-row" style="margin-top:14px;">
                    <div class="product-price">${currency(product.price)}</div>
                    <div class="qty-control">
                        <button class="qty-btn minus-btn" type="button">-</button>
                        <span class="qty-value">${quantity}</span>
                        <button class="qty-btn plus-btn" type="button">+</button>
                    </div>
                </div>
                <div class="recommendation-row" style="margin-top:12px;">
                    <button class="action-chip note-btn" type="button">Catatan</button>
                    ${bundleText ? `<button class="action-chip bundle-btn" type="button">Combo: ${bundleText}</button>` : ''}
                </div>
            `;

            card.querySelector('.favorite-btn').onclick = () => toggleWishlist(product._id);
            card.querySelector('.minus-btn').onclick = () => updateCart(product._id, -1);
            card.querySelector('.plus-btn').onclick = () => updateCart(product._id, 1);
            card.querySelector('.note-btn').onclick = () => customizeItem(product._id);

            const bundleButton = card.querySelector('.bundle-btn');
            if (bundleButton) {
                bundleButton.onclick = () => {
                    const suggestedProduct = (state.bootstrap?.products || []).find((item) => item.name === bundleText);
                    if (suggestedProduct) {
                        updateCart(suggestedProduct._id, 1);
                    }
                };
            }

            els.productList.appendChild(card);
        });
    }

    function renderMemberCard() {
        const customer = state.customer;
        els.memberCard.classList.toggle('hidden', !customer);
        if (!customer) return;

        els.memberTierBadge.textContent = customer.tier || 'Bronze';
        els.memberNameValue.textContent = customer.name || '-';
        els.memberPointsValue.textContent = `${customer.points || 0} pts`;
        els.memberCodeValue.textContent = customer.memberCode || '-';
    }

    function getFallbackSummary() {
        let subtotal = 0;
        getCartItems().forEach((item) => {
            const addOnTotal = (item.modifiers?.addOns || []).reduce((sum, addOn) => sum + Number(addOn.price || 0), 0);
            subtotal += item.quantity * (item.unitPrice + addOnTotal);
        });

        const settings = state.bootstrap?.settings || { taxPercent: 10, servicePercent: 5 };
        const service = els.diningOption.value === 'takeaway' ? 0 : Math.round(subtotal * (settings.servicePercent / 100));
        const tax = Math.round(subtotal * (settings.taxPercent / 100));
        const total = subtotal + service + tax;

        return {
            subtotal,
            promoDiscount: 0,
            memberDiscount: 0,
            serviceCharge: service,
            tax,
            roundingAdjustment: 0,
            total,
        };
    }

    function renderCart() {
        const cartItems = getCartItems();
        els.cartLines.innerHTML = '';
        els.cartEmpty.classList.toggle('hidden', cartItems.length > 0);

        cartItems.forEach((item) => {
            const line = document.createElement('div');
            line.className = 'cart-line';
            line.innerHTML = `
                <div class="cart-line-meta">
                    <div>
                        <div style="font-weight:600;">${item.name}</div>
                        <div class="muted" style="font-size:12px;">${item.modifiers.sweetness || 'Normal'} / ${item.modifiers.ice || 'Normal'} / ${item.modifiers.spice || 'Normal'}</div>
                        ${(item.modifiers.addOns || []).length ? `<div class="muted" style="font-size:12px; margin-top:4px;">Add-on: ${item.modifiers.addOns.map((addOn) => addOn.name).join(', ')}</div>` : ''}
                        ${item.note ? `<div class="muted" style="font-size:12px; margin-top:4px;">Catatan: ${item.note}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div>${currency(item.unitPrice * item.quantity)}</div>
                        <div class="qty-control" style="margin-top:8px;">
                            <button class="qty-btn minus-btn" type="button">-</button>
                            <span class="qty-value">${item.quantity}</span>
                            <button class="qty-btn plus-btn" type="button">+</button>
                        </div>
                    </div>
                </div>
            `;

            const buttons = line.querySelectorAll('button');
            buttons[0].onclick = () => updateCart(item.productId, -1);
            buttons[1].onclick = () => updateCart(item.productId, 1);
            els.cartLines.appendChild(line);
        });

        const summary = state.estimate?.summary || getFallbackSummary();
        const discountTotal = Number(summary.promoDiscount || 0) + Number(summary.memberDiscount || 0);

        els.subtotalValue.textContent = currency(summary.subtotal);
        els.discountValue.textContent = currency(discountTotal);
        els.serviceValue.textContent = currency(summary.serviceCharge || 0);
        els.taxValue.textContent = currency(summary.tax || 0);
        els.roundingValue.textContent = currency(summary.roundingAdjustment || 0);
        els.totalValue.textContent = currency(summary.total || 0);
        els.cartCount.textContent = `${cartItems.length} item`;
        els.cartMeta.textContent = cartItems.length ? currency(summary.total || 0) : t('empty');
        els.cartToggleSummary.textContent = cartItems.length
            ? `${cartItems.length} item - ${currency(summary.total || 0)}`
            : '0 item - Rp 0';
        els.checkoutBtn.disabled = cartItems.length === 0;

        if (!cartItems.length) {
            setCartOpen(false);
        }
    }

    function setCartOpen(isOpen) {
        state.cartOpen = Boolean(isOpen);
        els.floatingCart.classList.toggle('collapsed', !state.cartOpen);
        els.cartBackdrop.classList.toggle('hidden', !state.cartOpen);
        els.cartToggleBtn.setAttribute('aria-expanded', state.cartOpen ? 'true' : 'false');
    }

    function setServiceMenuOpen(isOpen) {
        state.serviceMenuOpen = Boolean(isOpen);
        els.serviceDrawer.classList.toggle('hidden', !state.serviceMenuOpen);
        els.serviceBackdrop.classList.toggle('hidden', !state.serviceMenuOpen);
    }

    function setLoading(isLoading, message = 'Sedang memuat...') {
        els.clientLoadingOverlay.classList.toggle('hidden', !isLoading);
        els.clientLoadingText.textContent = message;
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }
        if (!response.ok) {
            throw new Error(data?.msg || 'Request gagal');
        }
        return data;
    }

    async function fetchBootstrap() {
        setLoading(true, 'Memuat menu dan meja...');
        try {
            state.bootstrap = await fetchJson(`/api/client/bootstrap/${window.CLIENT_CONTEXT.uniqueIdentifier}`);
            els.tableBadge.textContent = state.bootstrap.table.name;
            els.heroTitle.textContent = state.bootstrap.settings.brandName;
            els.heroSubtitle.textContent = state.bootstrap.settings.heroSubtitle;
            els.miniOutlet.textContent = state.bootstrap.settings.outletName;
            els.miniTable.textContent = state.bootstrap.table.name;
            els.miniTax.textContent = `${state.bootstrap.settings.taxPercent}%`;
            els.miniService.textContent = `${state.bootstrap.settings.servicePercent}%`;
            els.searchInput.placeholder = t('search');
            els.checkoutBtn.textContent = t('checkout');
            renderCategories();
            renderPromos();
            renderRecommendations();
            renderServiceActions();
            renderProducts();
            renderMemberCard();
            scheduleEstimate();
            renderStatusCard();
        } finally {
            setLoading(false);
        }
    }

    async function estimateOrder() {
        const items = getCartItems().map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            note: item.note,
            modifiers: item.modifiers,
        }));

        if (!items.length) {
            state.estimate = null;
            renderCart();
            return;
        }

        try {
            state.estimate = await fetchJson('/api/client/orders/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items,
                    orderType: els.diningOption.value,
                    diningOption: els.diningOption.value,
                    customerPhone: els.customerPhone.value.trim(),
                    voucherCode: els.voucherCode.value.trim(),
                }),
            });
            renderCart();
        } catch (error) {
            state.estimate = null;
            renderCart();
        }
    }

    async function lookupCustomer() {
        const phone = els.customerPhone.value.trim();
        if (!phone) {
            state.customer = null;
            renderMemberCard();
            scheduleEstimate();
            return;
        }

        try {
            state.customer = await fetchJson('/api/client/customer/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone }),
            });
            if (state.customer?.name && !els.customerName.value.trim()) {
                els.customerName.value = state.customer.name;
            }
            if (state.customer?.email && !els.customerEmail.value.trim()) {
                els.customerEmail.value = state.customer.email;
            }
        } catch (error) {
            state.customer = null;
        }

        renderMemberCard();
        scheduleEstimate();
    }

    async function submitOrder() {
        const items = getCartItems().map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            note: item.note,
            modifiers: item.modifiers,
        }));

        if (!items.length) return;

        const customerName = els.customerName.value.trim();
        const customerPhone = els.customerPhone.value.trim();
        const customerEmail = els.customerEmail.value.trim();

        if (!customerName) {
            alert('Nama pelanggan wajib diisi.');
            els.customerName.focus();
            return;
        }
        if (!customerPhone) {
            alert('Nomor WhatsApp wajib diisi.');
            els.customerPhone.focus();
            return;
        }
        if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
            alert('Format email belum valid.');
            els.customerEmail.focus();
            return;
        }

        const payload = {
            tableId: state.bootstrap.table._id,
            customerName,
            customerPhone,
            customerWhatsapp: customerPhone,
            customerEmail,
            orderType: els.diningOption.value,
            diningOption: els.diningOption.value,
            paymentPreference: els.paymentPreference.value,
            voucherCode: els.voucherCode.value.trim(),
            note: els.orderNote.value.trim(),
            customerRequest: els.takeawayAddress.value.trim(),
            items,
        };

        els.checkoutBtn.disabled = true;
        setLoading(true, 'Mengirim pesanan ke kasir...');
        try {
            const data = await fetchJson('/api/client/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            state.latestOrderId = data._id;
            state.cart = {};
            state.estimate = { summary: data.pricing };
            persistState();
            renderCart();
            renderProducts();
            setCartOpen(false);
            renderStatusCard(data);
            alert(`Pesanan ${data.orderCode} berhasil dikirim.`);
        } catch (error) {
            alert(error.message || 'Gagal membuat order');
        } finally {
            els.checkoutBtn.disabled = false;
            setLoading(false);
        }
    }

    async function callService(type) {
        try {
            await fetchJson(`/api/client/tables/${window.CLIENT_CONTEXT.uniqueIdentifier}/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    customerName: els.customerName.value.trim() || 'Customer',
                    note: els.orderNote.value.trim(),
                }),
            });
            alert(`${type} berhasil dikirim.`);
        } catch (error) {
            alert(error.message || 'Panggilan gagal dikirim.');
        } finally {
            setLoading(false);
            setServiceMenuOpen(false);
        }
    }

    async function pollOrder() {
        if (!state.latestOrderId) return;
        try {
            const order = await fetchJson(`/api/client/orders/${state.latestOrderId}/status`);
            renderStatusCard(order);
        } catch (error) {
            /* ignore polling failures */
        }
    }

    function formatOrderStatusMessage(order) {
        const status = String(order.status || 'pending').toLowerCase();
        if (status === 'accepted') return 'Pesanan sudah di-ACC kasir dan menunggu diproses.';
        if (status === 'preparing') return 'Pesanan sedang diproses oleh dapur/bar.';
        if (status === 'ready') return 'Pesanan siap diantar ke meja Anda.';
        if (status === 'served') return 'Pesanan sudah diterima pelanggan.';
        if (status === 'paid') return 'Pesanan sudah dibayar dan selesai.';
        if (status === 'cancelled') return 'Pesanan dibatalkan.';
        return 'Pesanan menunggu ACC kasir.';
    }

    function renderStatusCard(order) {
        const activeOrder = order || null;
        if (!activeOrder && !state.latestOrderId) {
            els.statusCard.classList.add('hidden');
            return;
        }

        els.statusCard.classList.remove('hidden');
        if (!activeOrder) return;

        els.statusBadge.textContent = String(activeOrder.status || 'pending').toUpperCase();
        els.statusText.textContent = formatOrderStatusMessage(activeOrder);
        els.latestOrderMeta.textContent = `${currency(activeOrder.pricing?.total || 0)} / ${activeOrder.paymentStatus || 'unpaid'} / ${activeOrder.customerName || 'Customer'}`;
        els.statusOrderCode.textContent = activeOrder.orderCode || '-';
        els.statusQueueInfo.textContent = `${activeOrder.queueNumber || '-'} / ${activeOrder.paymentStatus || 'unpaid'} / ${activeOrder.paymentPreference || 'pay_at_cashier'}`;
    }

    async function shareOrder() {
        if (!state.latestOrderId) {
            alert('Belum ada order yang bisa dibagikan.');
            return;
        }

        const shareText = `Order Arum Dalu: ${state.latestOrderId}`;
        if (navigator.share) {
            try {
                await navigator.share({ text: shareText, url: window.location.href });
                return;
            } catch (error) {
                /* fallback to clipboard */
            }
        }

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
            alert('Info order berhasil disalin.');
            return;
        }

        alert(shareText);
    }

    function updateSelectionLabels() {
        els.paymentPreferenceLabel.textContent = paymentPreferenceLabel(els.paymentPreference.value);
        els.diningOptionLabel.textContent = diningLabel(els.diningOption.value);
    }

    function bindEvents() {
        els.searchInput.addEventListener('input', (event) => {
            state.search = event.target.value;
            renderProducts();
        });
        els.checkoutBtn.addEventListener('click', submitOrder);
        els.themeToggle.addEventListener('click', () => {
            state.darkMode = !state.darkMode;
            persistState();
            setBodyMode();
        });
        els.languageToggle.addEventListener('click', async () => {
            state.language = state.language === 'id' ? 'en' : 'id';
            persistState();
            await fetchBootstrap();
        });
        els.feedbackBtn.addEventListener('click', async () => {
            const comment = window.prompt('Bagaimana pengalaman Anda hari ini?');
            if (!comment) return;
            try {
                await fetchJson('/api/client/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerName: els.customerName.value.trim() || 'Customer',
                        phone: els.customerPhone.value.trim(),
                        comment,
                        source: 'client-web',
                        orderId: state.latestOrderId || null,
                        rating: 5,
                    }),
                });
                alert('Terima kasih atas feedback Anda.');
            } catch (error) {
                alert(error.message || 'Feedback gagal dikirim.');
            }
        });
        els.customerPhone.addEventListener('change', lookupCustomer);
        els.voucherCode.addEventListener('input', scheduleEstimate);
        els.diningOption.addEventListener('change', () => {
            updateSelectionLabels();
            scheduleEstimate();
        });
        els.paymentPreference.addEventListener('change', updateSelectionLabels);
        els.refreshStatusBtn.addEventListener('click', pollOrder);
        els.shareOrderBtn.addEventListener('click', shareOrder);
        els.serviceMenuBtn.addEventListener('click', () => setServiceMenuOpen(true));
        els.openServicePanelBtn.addEventListener('click', () => setServiceMenuOpen(true));
        els.serviceCloseBtn.addEventListener('click', () => setServiceMenuOpen(false));
        els.serviceBackdrop.addEventListener('click', () => setServiceMenuOpen(false));
        els.cartToggleBtn.addEventListener('click', () => setCartOpen(true));
        els.cartCloseBtn.addEventListener('click', () => setCartOpen(false));
        els.cartBackdrop.addEventListener('click', () => setCartOpen(false));
        els.installBtn.addEventListener('click', async () => {
            if (!state.installPrompt) {
                alert('Tambahkan halaman ini ke home screen lewat menu browser jika prompt belum muncul.');
                return;
            }
            state.installPrompt.prompt();
            await state.installPrompt.userChoice;
            state.installPrompt = null;
        });
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            state.installPrompt = event;
            els.installBtn.textContent = 'Install App';
        });
    }

    async function init() {
        cacheDom();
        setBodyMode();
        bindEvents();
        setLoading(true, 'Menyiapkan halaman pelanggan...');
        updateSelectionLabels();
        try {
            await fetchBootstrap();
            if (state.latestOrderId) {
                pollOrder();
                setInterval(pollOrder, 10000);
            }
            renderCart();
        } catch (error) {
            setLoading(false);
            alert(error.message || 'Halaman pelanggan gagal dimuat.');
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();





