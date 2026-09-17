import Header from './components/Header'
import Hero from './components/Hero'
import Features from './components/Features'
import PlatformAnalytics from './components/PlatformAnalytics'
import CareerBanner from './components/CareerBanner'
import Footer from './components/Footer'
const LandingPage = () => {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Header/>
      <Hero/>
      <Features/>
      <PlatformAnalytics/>
      <CareerBanner/>
      <Footer/>
    </div>
  )
}

export default LandingPage
