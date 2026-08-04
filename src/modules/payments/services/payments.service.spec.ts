import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection } from 'mongoose';
import { PaymentStatus } from '../../../common/types/enums/payment-status.enum';
import { OrdersService } from '../../orders/services/orders.service';
import { PaymentEntityStatus, PaymentProvider } from '../constants/payments.constants';
import { Payment } from '../schemas/payment.schema';
import { PaymentsService } from './payments.service';

/**
 * PaymentsService Unit Tests
 */
describe('PaymentsService', () => {
  let service: PaymentsService;
  let ordersService: jest.Mocked<OrdersService>;
  let paymentModel: any;
  let connection: any;
  let configService: jest.Mocked<ConfigService>;

  const ORDER_ID = '66f1a2b3c4d5e6f7a8b9c0ff';
  const USER_ID = '66f1a2b3c4d5e6f7a8b9c000';
  const PAYMENT_INTENT_ID = 'pi_3ABC123';
  const CLIENT_SECRET = 'pi_3ABC123_secret_xyz';

  beforeEach(async () => {
    paymentModel = {
      create: jest.fn(),
      findOne: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    const sessionMock = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
      withTransaction: jest.fn().mockImplementation((cb) => cb()),
    };

    connection = {
      startSession: jest.fn().mockResolvedValue(sessionMock),
    };

    ordersService = {
      findOrderTotalForPayment: jest.fn(),
      markAsPaid: jest.fn(),
      markAsPaymentFailed: jest.fn(),
      markAsRefunded: jest.fn(),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'stripe.secretKey') return 'sk_test_mock';
        if (key === 'stripe.webhookSecret') return 'whsec_mock';
        return defaultValue;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getModelToken(Payment.name), useValue: paymentModel },
        { provide: 'DatabaseConnection', useValue: connection },
        { provide: OrdersService, useValue: ordersService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    // Mock the stripe instance directly to avoid network calls
    (service as any).stripe = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: PAYMENT_INTENT_ID,
          client_secret: CLIENT_SECRET,
        }),
        retrieve: jest.fn(),
      },
      refunds: {
        create: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createIntent', () => {
    it('should create a Stripe PaymentIntent and a pending Payment record', async () => {
      ordersService.findOrderTotalForPayment.mockResolvedValue(120);
      paymentModel.exec.mockResolvedValue(null); // No existing pending payment

      const result = await service.createIntent(USER_ID, { orderId: ORDER_ID, currency: 'usd' });

      expect(ordersService.findOrderTotalForPayment).toHaveBeenCalledWith(ORDER_ID, USER_ID);
      expect((service as any).stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12000,
          currency: 'usd',
          metadata: { orderId: ORDER_ID, userId: USER_ID },
        }),
        expect.objectContaining({
          idempotencyKey: `order-${ORDER_ID}`,
        }),
      );
      expect(paymentModel.create).toHaveBeenCalledWith({
        orderId: ORDER_ID,
        userId: USER_ID,
        paymentIntentId: PAYMENT_INTENT_ID,
        provider: PaymentProvider.STRIPE,
        status: PaymentEntityStatus.PENDING,
        currency: 'usd',
        amount: 12000,
      });

      expect(result).toEqual({
        clientSecret: CLIENT_SECRET,
        paymentIntentId: PAYMENT_INTENT_ID,
        amount: 12000,
        currency: 'usd',
      });
    });
  });
});
