import React from 'react';
import { isMobile } from 'react-device-detect';
import MobileAccountView from '../pages/mobile/MobileAccountView';
import DesktopAccountView from '../pages/desktop/DesktopAccountView';
import { useAuth } from '../context/AuthContext';

const Account = () => {
  const { user } = useAuth();
  return (
     <div>
	{isMobile ? (
        <MobileAccountView user={user} />
      ) : (
        <DesktopAccountView user={user} />
      )}
    </div>
  );
};

export default Account;