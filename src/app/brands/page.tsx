import type {Metadata} from 'next'
import {BrandDirectoryPage} from '@/components/brand-directory'
import {brandDirectory} from '@/lib/brand-directory'

export const metadata: Metadata = {
  title: 'HVAC Brands We Service in Chicago | City & Suburban',
  description: `Repair, installation and maintenance for ${brandDirectory.length} heating, cooling and water heater brands in Chicago.`,
  alternates: {canonical: 'https://citysuburbanheating.com/services/brands/'},
}

export default function BrandsPage() {
  return <BrandDirectoryPage />
}
