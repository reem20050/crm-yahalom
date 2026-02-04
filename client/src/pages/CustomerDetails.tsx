import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, MapPin, Phone, Mail, FileText, Calendar } from 'lucide-react';
import { customersApi } from '../services/api';

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const customer = data?.customer;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה ללקוחות
      </button>

      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center">
          <Building2 className="w-8 h-8 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer?.company_name}</h1>
          {customer?.city && (
            <p className="text-gray-500 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {customer.city}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contacts */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">אנשי קשר</h2>
            {data?.contacts?.length > 0 ? (
              <div className="space-y-3">
                {data.contacts.map((contact: {
                  id: string;
                  name: string;
                  role: string;
                  phone: string;
                  email: string;
                  is_primary: boolean;
                }) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-gray-500">{contact.role}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary-600">
                          <Phone className="w-4 h-4" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary-600">
                          <Mail className="w-4 h-4" />
                          {contact.email}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין אנשי קשר</p>
            )}
          </div>

          {/* Sites */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">אתרים</h2>
            {data?.sites?.length > 0 ? (
              <div className="space-y-3">
                {data.sites.map((site: {
                  id: string;
                  name: string;
                  address: string;
                  requires_weapon: boolean;
                }) => (
                  <div key={site.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{site.name}</p>
                        <p className="text-sm text-gray-500">{site.address}</p>
                      </div>
                      {site.requires_weapon && (
                        <span className="badge badge-warning">דורש נשק</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין אתרים</p>
            )}
          </div>

          {/* Contracts */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">חוזים</h2>
            {data?.contracts?.length > 0 ? (
              <div className="space-y-3">
                {data.contracts.map((contract: {
                  id: string;
                  start_date: string;
                  end_date: string;
                  monthly_value: number;
                  status: string;
                }) => (
                  <div key={contract.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            {contract.start_date} - {contract.end_date || 'ללא הגבלה'}
                          </p>
                          <p className="text-sm text-gray-500">
                            ₪{contract.monthly_value?.toLocaleString()}/חודש
                          </p>
                        </div>
                      </div>
                      <span className={`badge ${contract.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                        {contract.status === 'active' ? 'פעיל' : contract.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין חוזים</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטים</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">ח.פ</dt>
                <dd className="font-medium">{customer?.business_id || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סוג שירות</dt>
                <dd className="font-medium">{customer?.service_type || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">תנאי תשלום</dt>
                <dd className="font-medium">{customer?.payment_terms || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סטטוס</dt>
                <dd>
                  <span className={`badge ${customer?.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
                    {customer?.status === 'active' ? 'פעיל' : customer?.status}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Recent invoices */}
          {data?.invoices?.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">חשבוניות אחרונות</h2>
              <div className="space-y-2">
                {data.invoices.slice(0, 5).map((invoice: {
                  id: string;
                  invoice_number: string;
                  total_amount: number;
                  status: string;
                }) => (
                  <div key={invoice.id} className="flex items-center justify-between text-sm">
                    <span>#{invoice.invoice_number}</span>
                    <span className={invoice.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}>
                      ₪{invoice.total_amount?.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
