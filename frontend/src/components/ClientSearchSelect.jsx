import { useState, useRef, useEffect } from 'react'
import { Search, X, User } from 'lucide-react'

export default function ClientSearchSelect({ clients = [], value, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const containerRef = useRef(null)
    const inputRef = useRef(null)

    const selectedClient = clients.find((c) => c.id === value)

    const filtered = clients.filter((c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false)
                if (!value) setSearchTerm('')
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [value])

    const handleInputFocus = () => {
        setIsOpen(true)
        setSearchTerm('')
    }

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value)
        setIsOpen(true)
        if (value) {
            onChange('')
        }
    }

    const handleSelect = (client) => {
        onChange(client.id)
        setSearchTerm('')
        setIsOpen(false)
    }

    const handleClear = (e) => {
        e.stopPropagation()
        onChange('')
        setSearchTerm('')
        setIsOpen(false)
        inputRef.current?.focus()
    }

    const displayValue = isOpen
        ? searchTerm
        : selectedClient
            ? selectedClient.name
            : searchTerm

    return (
        <div className="client-search-select" ref={containerRef}>
            <div className={`client-search-input-wrapper ${isOpen ? 'focused' : ''}`}>
                <Search size={16} className="client-search-icon" />
                <input
                    ref={inputRef}
                    type="text"
                    className="client-search-input"
                    placeholder="Buscar cliente por nombre..."
                    value={displayValue}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    autoComplete="off"
                />
                {(value || searchTerm) && (
                    <button
                        type="button"
                        className="client-search-clear"
                        onClick={handleClear}
                        tabIndex={-1}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="client-search-dropdown">
                    {filtered.length === 0 ? (
                        <div className="client-search-empty">
                            <User size={20} />
                            <span>No se encontraron clientes</span>
                        </div>
                    ) : (
                        filtered.map((client) => (
                            <button
                                key={client.id}
                                type="button"
                                className={`client-search-option ${client.id === value ? 'selected' : ''}`}
                                onClick={() => handleSelect(client)}
                            >
                                <div className="client-search-option-avatar">
                                    {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="client-search-option-info">
                                    <span className="client-search-option-name">{client.name}</span>
                                    {client.email && (
                                        <span className="client-search-option-email">{client.email}</span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
