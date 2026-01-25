import React from 'react';
import { MapPin, Phone, Mail } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-green-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-green-800 font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold">AGRIATOO</span>
            </div>
            <p className="text-green-200 mb-4">
              Your trusted partner for agricultural products. Connecting farmers with quality fertilizers, 
              pesticides, seeds, and tools from verified sellers across India.
            </p>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Pan India Delivery</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-green-200 hover:text-white">About Us</a></li>
              <li><a href="#" className="text-green-200 hover:text-white">Products</a></li>
              <li><a href="#" className="text-green-200 hover:text-white">Sellers</a></li>
              <li><a href="#" className="text-green-200 hover:text-white">Support</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4" />
                <span className="text-sm">+91-9999-AGRI-TOO</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span className="text-sm">support@agriatoo.com</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-green-700 pt-8 mt-8 text-center">
          <p className="text-green-200">
            &copy; 2024 AGRIATOO. All rights reserved. Empowering Indian Agriculture.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;