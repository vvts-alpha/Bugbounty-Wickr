import { ExternalLink, PhoneIcon, Tooltip } from '@/componentlibrary';
import { useSetting } from '@/store/hooks/useSetting';
import { isValidEmail } from '@/utils/strings';

/** Display a PhoneTool icon + link on alpha/beta network */
export const AmazonPhoneIcon: ReactFC<{ email?: string }> = ({ email }) => {
  const isProd = useSetting('isProduction');
  if (!isProd) {
    const validEmail = isValidEmail(email);

    if (validEmail) {
      const [user, domain] = email.split('@');

      if (user.length > 0 && domain === 'amazon.com') {
        return (
          <Tooltip tip="Open in Phone Tool (beta only)">
            <div style={{ display: 'inline-block' }}>
              <ExternalLink href={`https://phonetool.amazon.com/users/${user}`} skipConfirmation>
                <PhoneIcon />
              </ExternalLink>
            </div>
          </Tooltip>
        );
      }
    }
  }

  return null;
};
