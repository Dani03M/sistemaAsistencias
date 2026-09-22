import os
import re

frontend_dir = r"c:\Users\mig13\Videos\asistenciaConver\frontend\src\components"

# Helper to add headers to axios calls
def add_headers_to_axios(content):
    # This is a bit tricky with regex, but we can do string replacements for simple cases.
    # Replace axios.get(url) with axios.get(url, { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } })
    # It's safer to just set an axios interceptor in a global place!
    pass

# Setting an interceptor in App.jsx is much cleaner!
app_file = r"c:\Users\mig13\Videos\asistenciaConver\frontend\src\App.jsx"
with open(app_file, 'r', encoding='utf-8') as f:
    app_content = f.read()

interceptor_code = """
import axios from 'axios';

axios.interceptors.request.use((config) => {
  // Solo aplicar token de admin a las rutas de /api/admin
  if (config.url.includes('/api/admin')) {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
"""

if "axios.interceptors" not in app_content:
    app_content = app_content.replace("import React from 'react';", "import React from 'react';\n" + interceptor_code)
    with open(app_file, 'w', encoding='utf-8') as f:
        f.write(app_content)

print("Interceptor added to App.jsx")
