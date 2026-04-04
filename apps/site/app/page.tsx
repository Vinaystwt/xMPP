import { Footer } from '../components/footer'
import { Hero } from '../components/hero'
import { PackageInstall } from '../components/package-install'
import { ProofStrip } from '../components/proof-strip'
import { ProblemSection } from '../components/problem-section'
import { RouteScorer } from '../components/route-scorer'
import { SessionLifecycle } from '../components/session-lifecycle'

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <div id="route-scorer">
        <RouteScorer />
      </div>
      <SessionLifecycle />
      <ProofStrip />
      <PackageInstall />
      <Footer />
    </>
  )
}
