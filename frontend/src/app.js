/* Deal Editor — API client */

async function apiCall(method, url, body) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Request failed');
    return data.data;
}

const api = {
    open:           (p) => apiCall('POST', '/api/open', { path: p }),
    save:           (dir, deal) => apiCall('POST', '/api/save', { directory: dir, deal }),
    listProducts:   (dir) => apiCall('POST', '/api/list-products', { dir: dir }),
    getProduct:     (p) => apiCall('POST', '/api/get-product', { path: p }),
    openFileDialog: () => apiCall('GET', '/api/open-file'),
    browseDir:      () => apiCall('GET', '/api/browse-directory'),
    health:         () => apiCall('GET', '/api/health'),
};
