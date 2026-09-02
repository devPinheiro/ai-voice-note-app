import { ArrowLeft, Shield } from "lucide-react";

import { useNavigate } from "react-router-dom";

export const UnauthorizedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-red-600" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-4">
          Access Denied
        </h1>
        <p className="text-slate-600 mb-8">
          You don't have permission to access this page. Please contact your
          administrator if you believe this is an error.
        </p>

        <button
          onClick={() => navigate("/")}
          className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-3 rounded-lg hover:bg-slate-800 transition-colors font-medium mx-auto"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Go back</span>
        </button>
      </div>
    </div>
  );
};
