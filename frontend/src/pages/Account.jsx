import React from 'react';
import { isMobile } from 'react-device-detect';
import MobileAccountView from '../pages/mobile/MobileAccountView';
import DesktopAccountView from '../pages/desktop/DesktopAccountView';
import { useAuth } from '../contexts/AuthContext';


const Account = () => {
  return (
     <div>
      {isMobile ? <MobileAccountView /> : <DesktopAccountView />}
    </div>
  );
};

export default Account;