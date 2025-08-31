import React from "react";

const Account = () => {
  return (
     <div>
      {isMobile ? <MobileAccountView /> : <DesktopAccountView />}
    </div>
  );
};

export default Account;