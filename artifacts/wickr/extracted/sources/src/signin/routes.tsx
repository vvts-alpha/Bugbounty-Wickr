import { Navigate, Route, Routes } from 'react-router';
import { createRouteGenerator } from '@/utils/route';
import CheckYourEmail from './components/CheckYourEmail';
import CheckYourEmailInviteCode from './components/CheckYourEmailInviteCode';
import CompanyID from './components/CompanyID';
import ContinueWithoutTransferring from './components/ContinueWithoutTransferring';
import EnterpriseConfigure from './components/EnterpriseConfigure';
import EnterpriseSignIn from './components/EnterpriseSignIn';
import GuestUserEducation from './components/GuestUserEducation';
import Landing from './components/Landing';
import MasterRecoveryKey from './components/MasterRecoveryKey';
import NonSSOAccountRecovery from './components/NonSSOAccountRecovery';
import NonSSOCreatePassword from './components/NonSSOCreatePassword';
import NonSSOEnterInviteCode from './components/NonSSOEnterInviteCode';
import NonSSOPassword from './components/NonSSOPassword';
import RecoverYourAccount from './components/RecoverYourAccount';
import SSOEnterEmail from './components/SSOEnterEmail';
import SSOMigration from './components/SSOMigration';
import SignUp from './components/SignUp';
import Signin2FA from './components/Signin2FA';
import TransferData from './components/TransferData';
import VerifyDevice from './components/VerifyDevice';

const SIGNIN_ROOT_PATH = '/signin/';
export const SIGNIN_ROOT_SLUG = `${SIGNIN_ROOT_PATH}*`;
export { SIGNIN_ROOT_PATH };

const genRoute = createRouteGenerator(SIGNIN_ROOT_PATH);

const routes = {
  landing: '/landing',
  nonSSOPassword: '/nonSSOPassword',
  checkYourEmail: '/checkYourEmail',
  checkYourEmailInviteCode: '/checkYourEmailInviteCode',
  ssoEnterEmail: '/ssoEnterEmail',
  continueWithoutTransferring: '/continueWithoutTransferring',
  signUp: '/signUp',
  guestUserEducation: '/guestUserEducation',
  nonSSOAccountRecovery: '/nonSSOAccountRecovery',
  nonSSOEnterInviteCode: '/nonSSOEnterInviteCode',
  nonSSOCreatePassword: '/nonSSOCreatePassword',
  companyID: '/companyID',
  recoverYourAccount: '/recoverYourAccount',
  verifyDevice: '/verifyDevice',
  masterRecoveryKey: '/masterRecoveryKey',
  transferData: '/transferData',
  enterpriseConfigure: '/enterpriseConfigure',
  enterpriseSignIn: '/enterpriseSignIn',
  signin2FA: '/signin2FA',
  ssoMigration: '/ssoMigration',
};

export const generateSigninRoute = {
  landing: () => genRoute(routes.landing),
  nonSSOPassword: () => genRoute(routes.nonSSOPassword),
  checkYourEmail: () => genRoute(routes.checkYourEmail),
  checkYourEmailInviteCode: () => genRoute(routes.checkYourEmailInviteCode),
  ssoEnterEmail: () => genRoute(routes.ssoEnterEmail),
  continueWithoutTransferring: () => genRoute(routes.continueWithoutTransferring),
  signUp: () => genRoute(routes.signUp),
  guestUserEducation: () => genRoute(routes.guestUserEducation),
  nonSSOAccountRecovery: () => genRoute(routes.nonSSOAccountRecovery),
  nonSSOEnterInviteCode: () => genRoute(routes.nonSSOEnterInviteCode),
  nonSSOCreatePassword: () => genRoute(routes.nonSSOCreatePassword),
  companyID: () => genRoute(routes.companyID),
  recoverYourAccount: () => genRoute(routes.recoverYourAccount),
  verifyDevice: () => genRoute(routes.verifyDevice),
  masterRecoveryKey: () => genRoute(routes.masterRecoveryKey),
  transferData: () => genRoute(routes.transferData),
  enterpriseConfigure: () => genRoute(routes.enterpriseConfigure),
  enterpriseSignIn: () => genRoute(routes.enterpriseSignIn),
  signin2FA: () => genRoute(routes.signin2FA),
  ssoMigration: () => genRoute(routes.ssoMigration),
};

// TODO: Add all signin pages here
export const SigninRoutes = () => {
  return (
    <Routes>
      <Route index element={<Navigate to={routes.landing} replace />} />
      <Route path={routes.landing} element={<Landing />} />
      <Route path={routes.nonSSOPassword} element={<NonSSOPassword />} />
      <Route path={routes.checkYourEmail} element={<CheckYourEmail />} />
      <Route path={routes.ssoEnterEmail} element={<SSOEnterEmail />} />
      <Route path={routes.continueWithoutTransferring} element={<ContinueWithoutTransferring />} />
      <Route path={routes.signUp} element={<SignUp />} />
      <Route path={routes.guestUserEducation} element={<GuestUserEducation />} />
      <Route path={routes.nonSSOAccountRecovery} element={<NonSSOAccountRecovery />} />
      <Route path={routes.checkYourEmailInviteCode} element={<CheckYourEmailInviteCode />} />
      <Route path={routes.nonSSOEnterInviteCode} element={<NonSSOEnterInviteCode />} />
      <Route path={routes.nonSSOCreatePassword} element={<NonSSOCreatePassword />} />
      <Route path={routes.companyID} element={<CompanyID />} />
      <Route path={routes.recoverYourAccount} element={<RecoverYourAccount />} />
      <Route path={routes.verifyDevice} element={<VerifyDevice />} />
      <Route path={routes.masterRecoveryKey} element={<MasterRecoveryKey />} />
      <Route path={routes.transferData} element={<TransferData />} />
      <Route path={routes.enterpriseConfigure} element={<EnterpriseConfigure />} />
      <Route path={routes.enterpriseSignIn} element={<EnterpriseSignIn />} />
      <Route path={routes.signin2FA} element={<Signin2FA />} />
      <Route path={routes.ssoMigration} element={<SSOMigration />} />
    </Routes>
  );
};
