import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, UserCircle, Phone, Mail, MapPin, Calendar, Shield, Car } from 'lucide-react';
import { employeesApi } from '../services/api';

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  const employee = data?.employee;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/employees')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowRight className="w-5 h-5" />
        חזרה לעובדים
      </button>

      <div className="flex items-start gap-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
          <UserCircle className="w-12 h-12 text-gray-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {employee?.first_name} {employee?.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`badge ${employee?.status === 'active' ? 'badge-success' : 'badge-gray'}`}>
              {employee?.status === 'active' ? 'פעיל' : 'לא פעיל'}
            </span>
            {employee?.has_weapon_license && (
              <span className="badge badge-info flex items-center gap-1">
                <Shield className="w-3 h-3" />
                רישיון נשק
              </span>
            )}
            {employee?.has_driving_license && (
              <span className="badge badge-gray flex items-center gap-1">
                <Car className="w-3 h-3" />
                רישיון {employee.driving_license_type}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Contact info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטי קשר</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">טלפון</p>
                  <a href={`tel:${employee?.phone}`} className="text-primary-600 font-medium">
                    {employee?.phone}
                  </a>
                </div>
              </div>
              {employee?.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">אימייל</p>
                    <a href={`mailto:${employee.email}`} className="text-primary-600 font-medium">
                      {employee.email}
                    </a>
                  </div>
                </div>
              )}
              {employee?.address && (
                <div className="flex items-center gap-3 col-span-2">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">כתובת</p>
                    <p className="font-medium">{employee.address}, {employee.city}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent shifts */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">משמרות אחרונות</h2>
            {data?.recentShifts?.length > 0 ? (
              <div className="space-y-2">
                {data.recentShifts.slice(0, 10).map((shift: {
                  id: string;
                  date: string;
                  start_time: string;
                  end_time: string;
                  company_name: string;
                  site_name: string;
                  actual_hours: number;
                }) => (
                  <div key={shift.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{shift.company_name} - {shift.site_name}</p>
                      <p className="text-sm text-gray-500">{shift.date} | {shift.start_time} - {shift.end_time}</p>
                    </div>
                    {shift.actual_hours && (
                      <span className="text-sm text-gray-500">{shift.actual_hours} שעות</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">אין משמרות</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">פרטי העסקה</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">ת.ז</dt>
                <dd className="font-medium">{employee?.id_number}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">תאריך התחלה</dt>
                <dd className="font-medium">{employee?.hire_date}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">סוג העסקה</dt>
                <dd className="font-medium">
                  {employee?.employment_type === 'hourly' ? 'שעתי' :
                   employee?.employment_type === 'monthly' ? 'חודשי' : 'קבלן'}
                </dd>
              </div>
              {employee?.hourly_rate && (
                <div>
                  <dt className="text-sm text-gray-500">שכר שעתי</dt>
                  <dd className="font-medium">₪{employee.hourly_rate}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Documents */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">מסמכים</h2>
            {data?.documents?.length > 0 ? (
              <div className="space-y-2">
                {data.documents.map((doc: {
                  id: string;
                  document_type: string;
                  expiry_date: string;
                }) => (
                  <div key={doc.id} className="flex items-center justify-between text-sm">
                    <span>{doc.document_type}</span>
                    {doc.expiry_date && (
                      <span className="text-gray-500">{doc.expiry_date}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center">אין מסמכים</p>
            )}
          </div>

          {/* Emergency contact */}
          {employee?.emergency_contact_name && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">איש קשר לחירום</h2>
              <p className="font-medium">{employee.emergency_contact_name}</p>
              <a href={`tel:${employee.emergency_contact_phone}`} className="text-primary-600 text-sm">
                {employee.emergency_contact_phone}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
