import Support from './support.interface';
import PartnerAddress from '../usersInterfaces/partner_address.interface';
import PartnerContact from '../usersInterfaces/partner_contact.interface';
import PartnerPayment from '../usersInterfaces/partner_payment.interface';

interface Campaign {
  partner_name: string;
  partner_id: string;
  partner_slug: string;
  partner_imageURL: string;
  partner_address: PartnerAddress;
  partner_contact: PartnerContact;
  partner_payments: [PartnerPayment];
  // {
  //   nationalBank: string;
  //   pireausBank: string;
  //   eurobank: string;
  //   alphaBank: string;
  //   paypal: string;
  // };

  campaign_id: string;
  campaign_slug: string;
  campaign_imageURL: string;
  title: string;
  subtitle: string;
  terms: string;
  description: string;
  category: string;
  access: string;
  status: string;

  quantitative: boolean;
  stepAmount: number;
  minAllowed: number;
  maxAllowed: number;
  maxAmount: number;

  redeemStarts: number;
  redeemEnds: number;
  startsAt: number;
  expiresAt: number;

  confirmedTokens: {
    initialTokens: number,
    redeemedTokens: number
  };
  orderedTokens: {
    initialTokens: number,
    redeemedTokens: number
  };

  address: string;
  transactionHash: string;

  supports: Support[];

  createdAt: Date;
  updatedAt: Date;
}
export default Campaign;
