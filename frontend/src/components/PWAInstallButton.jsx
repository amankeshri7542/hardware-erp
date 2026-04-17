import { useState, useEffect, useRef } from 'react';
import { Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

export default function PWAInstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const deferredPrompt = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => setCanInstall(false);
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    deferredPrompt.current = null;
  };

  if (!canInstall) return null;

  return (
    <Button
      type="text"
      icon={<DownloadOutlined />}
      onClick={handleInstall}
      style={{ color: '#1677ff' }}
    >
      Install App
    </Button>
  );
}
