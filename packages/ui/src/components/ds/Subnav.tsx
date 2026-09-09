import * as React from 'react'

type SetSubnav = (node: React.ReactNode) => void

const SubnavContext = React.createContext<SetSubnav>(() => {})

export function SubnavProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: SetSubnav
}) {
  return <SubnavContext.Provider value={value}>{children}</SubnavContext.Provider>
}

/**
 * Publishes a node into the top nav's optional second row — the context-filter
 * strip discovery screens use for genre pills. Clears itself on unmount.
 */
export function useSubnav(node: React.ReactNode, deps: React.DependencyList) {
  const setSubnav = React.useContext(SubnavContext)

  React.useEffect(() => {
    setSubnav(node)
    return () => setSubnav(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
